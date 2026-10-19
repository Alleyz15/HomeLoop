-- Backend only. Existing valuation photos, financial formulas and workflow RPC
-- signatures are unchanged. Apply locally first; deployment needs separate approval.
begin;

alter table public.application_events add column owner_message text
  check (owner_message is null or char_length(owner_message) <= 4000);
-- An owner's own historic replies remain visible; admin notes are never copied.
update public.application_events set owner_message = left(note,4000)
  where actor_role = 'owner' and note is not null;

-- Do not backfill admin audit notes into customer messages. Column grants protect
-- private material even if an owner calls the Data API directly, bypassing the UI.
revoke select on public.application_events from public, anon, authenticated;
revoke select (note, payload) on public.application_events from public, anon, authenticated;
grant select (id, application_id, actor_id, actor_role, from_status, to_status,
              action, reason, created_at, owner_message)
  on public.application_events to authenticated;

create or replace function private.write_application_event(
  p_application_id uuid, p_actor_id uuid, p_actor_role text, p_from_status text,
  p_to_status text, p_action text, p_reason text, p_note text, p_payload jsonb
) returns void language sql set search_path = '' as $$
  insert into public.application_events
    (application_id, actor_id, actor_role, from_status, to_status, action, reason,
     note, payload, owner_message, created_at)
  values (p_application_id, p_actor_id, p_actor_role, p_from_status, p_to_status,
    p_action, p_reason, p_note, coalesce(p_payload, '{}'::jsonb),
    case when p_actor_role = 'owner' then left(p_note, 4000) else null end,
    pg_catalog.now());
$$;
revoke all on function private.write_application_event(uuid,uuid,text,text,text,text,text,text,jsonb)
  from public, anon, authenticated, service_role;

create table public.application_photos (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  context_event_id bigint not null references public.application_events(id),
  purpose text not null check (purpose in ('info_response', 'offer_review')),
  file_name text not null check (char_length(file_name) between 1 and 160),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  object_path text not null unique,
  state text not null default 'pending' check (state in ('pending','attached','cancelled')),
  event_id bigint references public.application_events(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  check ((state = 'attached') = (event_id is not null))
);
create index application_photos_application_idx on public.application_photos(application_id);
create index application_photos_user_idx on public.application_photos(user_id);
create index application_photos_context_idx on public.application_photos(context_event_id);
create index application_photos_event_idx on public.application_photos(event_id);
alter table public.application_photos enable row level security;
revoke all on public.application_photos from public, anon, authenticated;
grant select on public.application_photos to authenticated;
grant all on public.application_photos to service_role;
create policy "Owners read their own application photo reservations"
  on public.application_photos for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Admins read submitted application photos"
  on public.application_photos for select to authenticated
  using (state = 'attached' and (select private.is_admin()));

-- Pure internal lookup; callers lock the application before using this context.
create function private.application_photo_context(p_app public.applications, p_purpose text)
returns bigint language plpgsql stable set search_path = '' as $$
declare v_context bigint;
begin
  if p_purpose = 'info_response' and p_app.status = 'info_requested'
     and p_app.info_return_status in ('under_review','inspected') then
    select id into v_context from public.application_events
      where application_id = p_app.id and action = 'request_info'
      order by id desc limit 1;
  elsif p_purpose = 'offer_review' and p_app.status = 'offer_sent'
     and p_app.offer_expires_at > now() and p_app.review_count = 0 then
    select id into v_context from public.application_events
      where application_id = p_app.id and to_status = 'offer_sent'
        and action in ('issue_offer','respond_review','switch_plan')
      order by id desc limit 1;
  else
    raise exception 'this action is not available at the current application stage' using errcode = '22023';
  end if;
  if v_context is null then
    raise exception 'application request or offer event is missing' using errcode = '22023';
  end if;
  return v_context;
end;
$$;
revoke all on function private.application_photo_context(public.applications,text)
  from public, anon, authenticated, service_role;

create function public.reserve_application_photo(
  p_application_id uuid, p_purpose text, p_context_event_id bigint,
  p_file_name text, p_mime_type text, p_size_bytes bigint
) returns public.application_photos
language plpgsql security definer set search_path = '' as $$
declare v_app public.applications; v_photo public.application_photos;
  v_id uuid := gen_random_uuid(); v_extension text;
begin
  select * into v_app from public.applications where id = p_application_id for update;
  if not found or auth.uid() is null or v_app.user_id <> auth.uid() then
    raise exception 'application owner access required' using errcode = '42501';
  end if;
  if p_context_event_id is distinct from private.application_photo_context(v_app,p_purpose) then
    raise exception 'request or offer changed; reload before uploading' using errcode = '22023';
  end if;
  if p_file_name is null or char_length(btrim(p_file_name)) not between 1 and 160
     or p_file_name ~ '[[:cntrl:]/]' or position(chr(92) in p_file_name) > 0
     or p_size_bytes is null or p_size_bytes not between 1 and 5242880 then
    raise exception 'invalid photo name or size; maximum 5 MB' using errcode = '22023';
  end if;
  v_extension := case p_mime_type when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png' when 'image/webp' then 'webp' end;
  if v_extension is null then
    raise exception 'only JPEG, PNG and WebP photos are allowed' using errcode = '22023';
  end if;
  if (select count(*) from public.application_photos where application_id = p_application_id
      and context_event_id = p_context_event_id and state = 'pending' and expires_at > now()) >= 5 then
    raise exception 'maximum five pending photos per reply or review' using errcode = '22023';
  end if;
  insert into public.application_photos
    (id,application_id,user_id,context_event_id,purpose,file_name,mime_type,size_bytes,object_path)
  values (v_id,p_application_id,v_app.user_id,p_context_event_id,p_purpose,btrim(p_file_name),
    p_mime_type,p_size_bytes,v_app.user_id::text || '/' || p_application_id::text || '/' || v_id::text || '.' || v_extension)
  returning * into v_photo;
  return v_photo;
end;
$$;

create function public.cancel_application_photo(p_photo_id uuid)
returns public.application_photos
language plpgsql security definer set search_path = '' as $$
declare v_photo public.application_photos; v_app uuid;
begin
  select application_id into v_app from public.application_photos
    where id = p_photo_id and user_id = auth.uid();
  if v_app is null then
    raise exception 'photo owner access required' using errcode = '42501';
  end if;
  -- Keep lock order identical to reservation/submission: application, then photo.
  perform 1 from public.applications where id = v_app for update;
  select * into v_photo from public.application_photos where id = p_photo_id for update;
  if not found or auth.uid() is null or v_photo.user_id <> auth.uid() then
    raise exception 'photo owner access required' using errcode = '42501';
  end if;
  if v_photo.state = 'attached' then
    raise exception 'submitted photos cannot be removed or replaced' using errcode = '22023';
  end if;
  update public.application_photos set state = 'cancelled' where id = p_photo_id returning * into v_photo;
  return v_photo;
end;
$$;

-- Separate bucket: existing valuation photos and their policies remain untouched.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('application-photos','application-photos',false,5242880,
  array['image/jpeg','image/png','image/webp']);

-- Policy helper returns only a permission boolean; it never exposes file contents.
create function private.application_photo_access(p_path text, p_operation text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_photo public.application_photos; v_app public.applications;
begin
  if auth.uid() is null then return false; end if;
  select * into v_photo from public.application_photos where object_path = p_path;
  if not found then return false; end if;
  if p_operation = 'read' then
    return (v_photo.user_id = auth.uid())
      or (v_photo.state = 'attached' and private.is_admin());
  end if;
  if v_photo.user_id <> auth.uid() then return false; end if;
  if p_operation = 'delete' then return v_photo.state = 'cancelled'; end if;
  if p_operation <> 'upload' or v_photo.state <> 'pending' or v_photo.expires_at <= now() then return false; end if;
  select * into v_app from public.applications where id = v_photo.application_id;
  begin
    return v_photo.context_event_id = private.application_photo_context(v_app,v_photo.purpose);
  exception when sqlstate '22023' then return false;
  end;
end;
$$;
revoke all on function private.application_photo_access(text,text) from public,anon;
grant execute on function private.application_photo_access(text,text) to authenticated;
create policy "Upload only a current owned application photo reservation"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'application-photos'
    and private.application_photo_access(name,'upload'));
create policy "Read own or admin submitted application photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'application-photos'
    and private.application_photo_access(name,'read'));
create policy "Delete only cancelled unsubmitted application photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'application-photos'
    and private.application_photo_access(name,'delete'));
-- Deliberately no UPDATE policy: uploads use fresh UUID names, never upsert.

create function public.submit_application_response(
  p_application_id uuid, p_purpose text, p_context_event_id bigint,
  p_message text, p_photo_ids uuid[] default '{}'::uuid[]
) returns public.applications
language plpgsql security definer set search_path = '' as $$
declare v_app public.applications; v_photo public.application_photos;
  v_object storage.objects; v_event bigint; v_ids uuid[] := coalesce(p_photo_ids,'{}'::uuid[]);
begin
  select * into v_app from public.applications where id = p_application_id for update;
  if not found or auth.uid() is null or v_app.user_id <> auth.uid() then
    raise exception 'application owner access required' using errcode = '42501';
  end if;
  if p_context_event_id is distinct from private.application_photo_context(v_app,p_purpose) then
    raise exception 'request or offer changed; reload before sending' using errcode = '22023';
  end if;
  if p_message is null or char_length(btrim(p_message)) not between 1 and 4000 then
    raise exception 'a reply or review reason of 1–4000 characters is required' using errcode = '22023';
  end if;
  if cardinality(v_ids) > 5 or cardinality(v_ids) <> (select count(distinct id) from unnest(v_ids) id) then
    raise exception 'choose at most five different photos' using errcode = '22023';
  end if;
  -- Lock all submitted reservations in a stable order; never trust caller paths.
  for v_photo in select * from public.application_photos where id = any(v_ids) order by id for update loop
    if v_photo.application_id <> p_application_id or v_photo.user_id <> auth.uid()
       or v_photo.purpose <> p_purpose or v_photo.context_event_id <> p_context_event_id
       or v_photo.state <> 'pending' or v_photo.expires_at <= now() then
      raise exception 'photo does not belong to this pending response' using errcode = '22023';
    end if;
    select * into v_object from storage.objects
      where bucket_id = 'application-photos' and name = v_photo.object_path for update;
    if not found or v_object.owner_id is distinct from auth.uid()::text
       or v_object.metadata->>'mimetype' is distinct from v_photo.mime_type
       or v_object.metadata->>'size' is distinct from v_photo.size_bytes::text then
      raise exception 'photo upload is missing or its metadata does not match' using errcode = '22023';
    end if;
  end loop;
  if (select count(*) from public.application_photos where id = any(v_ids)) <> cardinality(v_ids) then
    raise exception 'one or more photos are unavailable' using errcode = '22023';
  end if;
  -- Reuse the established state machine, expiry/review limits and single event.
  if p_purpose = 'info_response' then
    v_app := public.provide_info(p_application_id,btrim(p_message),'{}'::jsonb);
    select id into v_event from public.application_events
      where application_id = p_application_id and action = 'provide_info' order by id desc limit 1;
  else
    v_app := public.request_review(p_application_id,btrim(p_message),null,'{}'::jsonb);
    select id into v_event from public.application_events
      where application_id = p_application_id and action = 'request_review' order by id desc limit 1;
    update public.application_events set owner_message = btrim(p_message) where id = v_event;
  end if;
  update public.application_photos set state = 'attached',event_id = v_event where id = any(v_ids);
  return v_app;
end;
$$;

create function public.send_owner_message(p_application_id uuid,p_message text,p_internal_note text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_app public.applications; v_id bigint;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_message is null or char_length(btrim(p_message)) not between 1 and 4000 then
    raise exception 'owner message must contain 1–4000 characters' using errcode = '22023';
  end if;
  select * into v_app from public.applications where id = p_application_id for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  insert into public.application_events(application_id,actor_id,actor_role,from_status,to_status,
    action,note,payload,owner_message)
  values (p_application_id,auth.uid(),'admin',v_app.status,v_app.status,
    'owner_message',p_internal_note,'{}'::jsonb,btrim(p_message)) returning id into v_id;
  return v_id;
end;
$$;

create function public.get_application_audit(p_application_id uuid)
returns setof public.application_events
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  return query select * from public.application_events
    where application_id = p_application_id order by id;
end;
$$;

revoke all on function public.reserve_application_photo(uuid,text,bigint,text,text,bigint) from public,anon;
revoke all on function public.cancel_application_photo(uuid) from public,anon;
revoke all on function public.submit_application_response(uuid,text,bigint,text,uuid[]) from public,anon;
revoke all on function public.send_owner_message(uuid,text,text) from public,anon;
revoke all on function public.get_application_audit(uuid) from public,anon;
grant execute on function public.reserve_application_photo(uuid,text,bigint,text,text,bigint) to authenticated;
grant execute on function public.cancel_application_photo(uuid) to authenticated;
grant execute on function public.submit_application_response(uuid,text,bigint,text,uuid[]) to authenticated;
grant execute on function public.send_owner_message(uuid,text,text) to authenticated;
grant execute on function public.get_application_audit(uuid) to authenticated;

comment on column public.application_events.owner_message is 'Explicit owner-visible text; note/payload remain admin-only via get_application_audit.';
comment on table public.application_photos is 'Follow-up photos only. 5 MiB, JPEG/PNG/WebP, five per response. Pending reservations expire after one hour. Submitted photos are immutable.';
commit;
