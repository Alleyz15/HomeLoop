alter table public.applications
  add column valuation_snapshot jsonb,
  add column plan_quote_snapshot jsonb,
  add column info_return_status text,
  add column plan_switch_count integer not null default 0,
  add column espa_signed_at timestamptz,
  add column espa_confirmed_at timestamptz,
  add column espa_confirmed_by uuid references auth.users (id) on delete set null;

alter table public.applications
  add constraint applications_valuation_snapshot_object_check
    check (
      valuation_snapshot is null
      or pg_catalog.jsonb_typeof(valuation_snapshot) = 'object'
    ),
  add constraint applications_plan_quote_snapshot_object_check
    check (
      plan_quote_snapshot is null
      or pg_catalog.jsonb_typeof(plan_quote_snapshot) = 'object'
    ),
  add constraint applications_info_return_status_check
    check (info_return_status in ('under_review', 'inspected')),
  add constraint applications_plan_switch_count_check
    check (plan_switch_count >= 0 and plan_switch_count <= 1),
  add constraint applications_espa_confirmation_check
    check (
      (espa_confirmed_at is null and espa_confirmed_by is null)
      or (espa_confirmed_at is not null and espa_confirmed_by is not null)
    );

alter table public.application_events
  add column reason text,
  add column payload jsonb not null default '{}'::jsonb;

alter table public.application_events
  add constraint application_events_payload_object_check
  check (pg_catalog.jsonb_typeof(payload) = 'object');

create index applications_offer_expiry_idx
  on public.applications (offer_expires_at)
  where status in ('offer_sent', 'review_requested');

create index applications_offer_month_plan_idx
  on public.applications (plan, offer_sent_at)
  where offer_sent_at is not null and offer_amount is not null;

create unique index applications_one_active_per_owner_idx
  on public.applications (user_id)
  where status not in ('withdrawn', 'declined', 'expired', 'rejected', 'handover');

insert into public.monthly_limits (month, plan_a_limit, plan_b_limit)
values
  (date '2027-01-01', 5000000, 20000000),
  (date '2027-02-01', 5000000, 20000000),
  (date '2027-03-01', 5000000, 20000000),
  (date '2027-04-01', 5000000, 20000000),
  (date '2027-05-01', 5000000, 20000000),
  (date '2027-06-01', 5000000, 20000000)
on conflict (month) do nothing;

create or replace function private.write_application_event(
  p_application_id uuid,
  p_actor_id uuid,
  p_actor_role text,
  p_from_status text,
  p_to_status text,
  p_action text,
  p_reason text,
  p_note text,
  p_payload jsonb
)
returns void
language sql
set search_path = ''
as $$
  insert into public.application_events (
    application_id,
    actor_id,
    actor_role,
    from_status,
    to_status,
    action,
    reason,
    note,
    payload,
    created_at
  )
  values (
    p_application_id,
    p_actor_id,
    p_actor_role,
    p_from_status,
    p_to_status,
    p_action,
    p_reason,
    p_note,
    coalesce(p_payload, '{}'::jsonb),
    pg_catalog.now()
  );
$$;

create or replace function private.application_offer(
  p_plan text,
  p_confirmed_value numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.round(
    p_confirmed_value
    * case p_plan
        when 'A' then 0.785::numeric
        when 'B' then 0.75::numeric
      end
  );
$$;

create or replace function private.check_monthly_limit(
  p_application_id uuid,
  p_plan text,
  p_offer_amount numeric,
  p_month date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit numeric;
  v_used numeric;
begin
  if p_plan not in ('A', 'B') then
    raise exception 'plan must be A or B' using errcode = '22023';
  end if;

  if p_offer_amount is null or p_offer_amount <= 0 then
    raise exception 'offer amount must be greater than zero' using errcode = '22023';
  end if;

  select
    case p_plan
      when 'A' then monthly_limits.plan_a_limit
      else monthly_limits.plan_b_limit
    end
  into v_limit
  from public.monthly_limits
  where monthly_limits.month = p_month
  for update;

  if not found then
    raise exception 'monthly limit is not configured for %', p_month
      using errcode = 'P0001';
  end if;

  select coalesce(pg_catalog.sum(applications.offer_amount), 0)
  into v_used
  from public.applications
  where applications.id <> p_application_id
    and applications.plan = p_plan
    and applications.offer_sent_at is not null
    and pg_catalog.date_trunc('month', applications.offer_sent_at)::date = p_month
    and applications.offer_amount is not null
    and applications.status in (
      'offer_sent',
      'review_requested',
      'accepted',
      'espa_signed',
      'listed',
      'buyer_found',
      'guarantee_triggered',
      'old_home_completed',
      'handover'
    );

  if v_used + p_offer_amount > v_limit then
    raise exception 'Plan % monthly limit exceeded: RM% used + RM% offer > RM% limit',
      p_plan,
      v_used,
      p_offer_amount,
      v_limit
      using errcode = 'P0001';
  end if;
end;
$$;

create or replace function private.expire_offers_internal()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications%rowtype;
  v_count integer := 0;
begin
  for v_application in
    select applications.*
    from public.applications
    where applications.status in ('offer_sent', 'review_requested')
      and applications.offer_expires_at is not null
      and applications.offer_expires_at <= pg_catalog.now()
    order by applications.id
    for update skip locked
  loop
    update public.applications
    set status = 'expired'
    where id = v_application.id;

    perform private.write_application_event(
      v_application.id,
      null,
      'system',
      v_application.status,
      'expired',
      'expire_offer',
      'The formal offer passed its 14-day expiry time.',
      null,
      pg_catalog.jsonb_build_object('offer_expires_at', v_application.offer_expires_at)
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function private.write_application_event(
  uuid, uuid, text, text, text, text, text, text, jsonb
) from public, anon, authenticated, service_role;
revoke execute on function private.application_offer(text, numeric)
  from public, anon, authenticated, service_role;
revoke execute on function private.check_monthly_limit(uuid, text, numeric, date)
  from public, anon, authenticated, service_role;
revoke execute on function private.expire_offers_internal()
  from public, anon, authenticated, service_role;

create or replace function public.expire_offers()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'authenticated caller or database scheduler required'
      using errcode = '42501';
  end if;

  return private.expire_offers_internal();
end;
$$;

create or replace function public.submit_application(
  p_valuation_id uuid,
  p_launch_id bigint,
  p_unit_type text,
  p_plan text,
  p_new_home_price numeric,
  p_new_home_price_source text,
  p_address_line text,
  p_postcode text,
  p_pdpa_consent boolean,
  p_valuation_snapshot jsonb,
  p_plan_quote_snapshot jsonb,
  p_title_no text default null
)
returns public.applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_launch public.sdp_launches%rowtype;
  v_application public.applications%rowtype;
  v_estimate numeric;
  v_low numeric;
  v_high numeric;
  v_district text;
  v_is_sdp boolean;
  v_new_home_price_source text;
  v_constraint_name text;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor_id::text, 0)
  );

  if exists (
    select 1
    from public.applications
    where applications.user_id = v_actor_id
      and applications.status not in (
        'withdrawn', 'declined', 'expired', 'rejected', 'handover'
      )
  ) then
    raise exception 'You already have an active application'
      using errcode = 'P0001';
  end if;

  if p_plan not in ('A', 'B') then
    raise exception 'plan must be A or B' using errcode = '22023';
  end if;

  if p_unit_type is null or pg_catalog.btrim(p_unit_type) = ''
     or p_address_line is null or pg_catalog.btrim(p_address_line) = ''
     or p_postcode is null or pg_catalog.btrim(p_postcode) = '' then
    raise exception 'unit type, full address, and postcode are required'
      using errcode = '22023';
  end if;

  if p_pdpa_consent is distinct from true then
    raise exception 'PDPA consent is required' using errcode = '22023';
  end if;

  if p_new_home_price is null or p_new_home_price <= 0 then
    raise exception 'new-home price must be greater than zero'
      using errcode = '22023';
  end if;

  if p_new_home_price_source not in ('from_price', 'price_from', 'sales_quote') then
    raise exception 'new-home price source must be from_price or sales_quote'
      using errcode = '22023';
  end if;

  v_new_home_price_source := case p_new_home_price_source
    when 'from_price' then 'price_from'
    else p_new_home_price_source
  end;

  if pg_catalog.jsonb_typeof(p_valuation_snapshot) <> 'object'
     or pg_catalog.jsonb_typeof(p_plan_quote_snapshot) <> 'object' then
    raise exception 'valuation and plan quote snapshots must be JSON objects'
      using errcode = '22023';
  end if;

  if p_valuation_snapshot ->> 'status' <> 'ok' then
    raise exception 'only a successful valuation can be submitted'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_valuation_snapshot -> 'is_sdp') <> 'boolean'
     or p_valuation_snapshot ->> 'confidence' not in ('high', 'medium', 'low')
     or coalesce(pg_catalog.btrim(p_valuation_snapshot ->> 'scheme'), '') = ''
     or coalesce(pg_catalog.btrim(p_valuation_snapshot ->> 'district'), '') = '' then
    raise exception 'valuation snapshot is missing scheme, district, confidence, or is_sdp'
      using errcode = '22023';
  end if;

  begin
    v_estimate := (p_valuation_snapshot ->> 'estimate')::numeric;
    v_low := (p_valuation_snapshot ->> 'low')::numeric;
    v_high := (p_valuation_snapshot ->> 'high')::numeric;
    v_is_sdp := (p_valuation_snapshot ->> 'is_sdp')::boolean;
  exception
    when invalid_text_representation then
      raise exception 'valuation snapshot has invalid numeric or boolean values'
        using errcode = '22023';
  end;

  if v_estimate is null or v_low is null or v_high is null
     or v_low <= 0 or v_estimate <= 0 or v_high <= 0
     or not (v_low <= v_estimate and v_estimate <= v_high) then
    raise exception 'valuation snapshot must have positive low <= estimate <= high values'
      using errcode = '22023';
  end if;

  v_district := pg_catalog.upper(pg_catalog.btrim(p_valuation_snapshot ->> 'district'));
  if v_district not in (
    'PETALING',
    'KUALA LUMPUR',
    'W.P. KUALA LUMPUR',
    'WILAYAH PERSEKUTUAN KUALA LUMPUR',
    'KLANG',
    'SEREMBAN',
    'GOMBAK',
    'SEPANG',
    'MUAR'
  ) then
    raise exception 'old home must be in one of the seven supported districts'
      using errcode = '22023';
  end if;

  perform 1
  from public.valuation_requests
  where valuation_requests.id = p_valuation_id
    and valuation_requests.user_id = v_actor_id
  for share;

  if not found then
    raise exception 'valuation request not found for the current owner'
      using errcode = '42501';
  end if;

  select sdp_launches.*
  into v_launch
  from public.sdp_launches
  where sdp_launches.id = p_launch_id
  for share;

  if not found then
    raise exception 'new-home launch not found' using errcode = '22023';
  end if;

  if v_launch.tier <> 'selling' then
    raise exception 'new-home launch is not currently on sale'
      using errcode = '22023';
  end if;

  if v_new_home_price_source = 'price_from'
     and (
       v_launch.price_from_rm is null
       or p_new_home_price <> v_launch.price_from_rm
     ) then
    raise exception 'price_from must match the launch from-price'
      using errcode = '22023';
  end if;

  if p_plan = 'A' and not v_is_sdp then
    raise exception 'Plan A requires an old home in an SDP township'
      using errcode = '22023';
  end if;

  if p_plan = 'A' and v_estimate > p_new_home_price then
    raise exception 'Plan A requires the old-home valuation not to exceed the new-home price'
      using errcode = '22023';
  end if;

  begin
    insert into public.applications (
      user_id,
      valuation_id,
      launch_id,
      unit_type,
      plan,
      new_home_price,
      new_home_price_source,
      address_line,
      postcode,
      title_no,
      pdpa_consent,
      pdpa_consent_at,
      status,
      valuation_snapshot,
      plan_quote_snapshot
    )
    values (
      v_actor_id,
      p_valuation_id,
      p_launch_id,
      pg_catalog.btrim(p_unit_type),
      p_plan,
      p_new_home_price,
      v_new_home_price_source,
      pg_catalog.btrim(p_address_line),
      pg_catalog.btrim(p_postcode),
      nullif(pg_catalog.btrim(p_title_no), ''),
      true,
      pg_catalog.now(),
      'submitted',
      p_valuation_snapshot,
      p_plan_quote_snapshot
    )
    returning * into v_application;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;
      if v_constraint_name = 'applications_one_active_per_owner_idx' then
        raise exception 'You already have an active application'
          using errcode = 'P0001';
      end if;
      raise;
  end;

  perform private.write_application_event(
    v_application.id,
    v_actor_id,
    'owner',
    null,
    'submitted',
    'submit_application',
    null,
    null,
    pg_catalog.jsonb_build_object(
      'plan', p_plan,
      'launch_id', p_launch_id,
      'new_home_price_source', v_new_home_price_source
    )
  );

  return v_application;
end;
$$;

create or replace function public.start_review(
  p_application_id uuid,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_application public.applications%rowtype;
begin
  if v_actor_id is null or not (select private.is_admin()) then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  select applications.* into v_application
  from public.applications
  where applications.id = p_application_id
  for update;

  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;
  if v_application.status <> 'submitted' then
    raise exception 'start_review requires status submitted, current status is %', v_application.status;
  end if;

  update public.applications set status = 'under_review'
  where id = p_application_id returning * into v_application;
  perform private.write_application_event(
    p_application_id, v_actor_id, 'admin', 'submitted', 'under_review',
    'start_review', null, p_note, p_payload
  );
  return v_application;
end;
$$;

create or replace function public.request_info(
  p_application_id uuid,
  p_reason text,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_application public.applications%rowtype;
  v_from_status text;
begin
  if v_actor_id is null or not (select private.is_admin()) then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_reason is null or pg_catalog.btrim(p_reason) = '' then
    raise exception 'information request reason is required' using errcode = '22023';
  end if;

  select applications.* into v_application
  from public.applications
  where applications.id = p_application_id
  for update;
  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;
  if v_application.status not in ('under_review', 'inspected') then
    raise exception 'request_info requires status under_review or inspected, current status is %', v_application.status;
  end if;

  v_from_status := v_application.status;
  update public.applications
  set status = 'info_requested', info_return_status = v_from_status
  where id = p_application_id returning * into v_application;
  perform private.write_application_event(
    p_application_id, v_actor_id, 'admin', v_from_status, 'info_requested',
    'request_info', pg_catalog.btrim(p_reason), p_note, p_payload
  );
  return v_application;
end;
$$;

create or replace function public.provide_info(
  p_application_id uuid,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_application public.applications%rowtype;
  v_to_status text;
begin
  select applications.* into v_application
  from public.applications
  where applications.id = p_application_id
  for update;
  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;
  if v_actor_id is null or v_application.user_id <> v_actor_id then
    raise exception 'application owner access required' using errcode = '42501';
  end if;
  if v_application.status <> 'info_requested'
     or v_application.info_return_status not in ('under_review', 'inspected') then
    raise exception 'provide_info requires a pending information request with a return status';
  end if;

  v_to_status := v_application.info_return_status;
  update public.applications
  set status = v_to_status, info_return_status = null
  where id = p_application_id returning * into v_application;
  perform private.write_application_event(
    p_application_id, v_actor_id, 'owner', 'info_requested', v_to_status,
    'provide_info', null, p_note, p_payload
  );
  return v_application;
end;
$$;

create or replace function public.send_indicative(
  p_application_id uuid,
  p_indicative_low numeric,
  p_indicative_high numeric,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_application public.applications%rowtype;
begin
  if v_actor_id is null or not (select private.is_admin()) then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_indicative_low is null or p_indicative_high is null
     or p_indicative_low <= 0 or p_indicative_high <= 0
     or p_indicative_low > p_indicative_high then
    raise exception 'indicative range must be positive with low not greater than high'
      using errcode = '22023';
  end if;

  select applications.* into v_application
  from public.applications where applications.id = p_application_id for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  if v_application.status <> 'under_review' then
    raise exception 'send_indicative requires status under_review, current status is %', v_application.status;
  end if;

  update public.applications
  set status = 'indicative_sent', indicative_low = p_indicative_low,
      indicative_high = p_indicative_high
  where id = p_application_id returning * into v_application;
  perform private.write_application_event(
    p_application_id, v_actor_id, 'admin', 'under_review', 'indicative_sent',
    'send_indicative', null, p_note,
    coalesce(p_payload, '{}'::jsonb) || pg_catalog.jsonb_build_object(
      'indicative_low', p_indicative_low, 'indicative_high', p_indicative_high
    )
  );
  return v_application;
end;
$$;

create or replace function public.proceed_application(
  p_application_id uuid,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare v_actor_id uuid := (select auth.uid()); v_application public.applications%rowtype;
begin
  select applications.* into v_application from public.applications
  where applications.id = p_application_id for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  if v_actor_id is null or v_application.user_id <> v_actor_id then
    raise exception 'application owner access required' using errcode = '42501';
  end if;
  if v_application.status <> 'indicative_sent' then
    raise exception 'proceed_application requires status indicative_sent, current status is %', v_application.status;
  end if;
  update public.applications set status = 'owner_proceed'
  where id = p_application_id returning * into v_application;
  perform private.write_application_event(
    p_application_id, v_actor_id, 'owner', 'indicative_sent', 'owner_proceed',
    'proceed', null, p_note, p_payload
  );
  return v_application;
end;
$$;

create or replace function public.withdraw_application(
  p_application_id uuid,
  p_reason text default null,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare v_actor_id uuid := (select auth.uid()); v_application public.applications%rowtype;
begin
  select applications.* into v_application from public.applications
  where applications.id = p_application_id for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  if v_actor_id is null or v_application.user_id <> v_actor_id then
    raise exception 'application owner access required' using errcode = '42501';
  end if;
  if v_application.status <> 'indicative_sent' then
    raise exception 'withdraw_application requires status indicative_sent, current status is %', v_application.status;
  end if;
  update public.applications set status = 'withdrawn'
  where id = p_application_id returning * into v_application;
  perform private.write_application_event(
    p_application_id, v_actor_id, 'owner', 'indicative_sent', 'withdrawn',
    'withdraw', nullif(pg_catalog.btrim(p_reason), ''), p_note, p_payload
  );
  return v_application;
end;
$$;

create or replace function public.schedule_inspection(
  p_application_id uuid,
  p_scheduled_at timestamptz,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare v_actor_id uuid := (select auth.uid()); v_application public.applications%rowtype;
begin
  if v_actor_id is null or not (select private.is_admin()) then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_scheduled_at is null then
    raise exception 'inspection schedule is required' using errcode = '22023';
  end if;
  select applications.* into v_application from public.applications
  where applications.id = p_application_id for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  if v_application.status <> 'owner_proceed' then
    raise exception 'schedule_inspection requires status owner_proceed, current status is %', v_application.status;
  end if;
  update public.applications
  set status = 'inspection_scheduled', inspection_scheduled_at = p_scheduled_at
  where id = p_application_id returning * into v_application;
  perform private.write_application_event(
    p_application_id, v_actor_id, 'admin', 'owner_proceed', 'inspection_scheduled',
    'schedule_inspection', null, p_note,
    coalesce(p_payload, '{}'::jsonb) || pg_catalog.jsonb_build_object('scheduled_at', p_scheduled_at)
  );
  return v_application;
end;
$$;

create or replace function public.record_inspection(
  p_application_id uuid,
  p_unit_type_confirmed boolean,
  p_condition text,
  p_confirmed_value numeric,
  p_value_adjust_reason text default null,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_application public.applications%rowtype;
  v_ai_estimate numeric;
begin
  if v_actor_id is null or not (select private.is_admin()) then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_unit_type_confirmed is null then
    raise exception 'unit type confirmation is required' using errcode = '22023';
  end if;
  if p_condition not in ('good', 'fair', 'needs_repair') then
    raise exception 'condition must be good, fair, or needs_repair' using errcode = '22023';
  end if;
  if p_confirmed_value is null or p_confirmed_value <= 0 then
    raise exception 'confirmed market value must be greater than zero' using errcode = '22023';
  end if;

  select applications.* into v_application from public.applications
  where applications.id = p_application_id for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  if v_application.status <> 'inspection_scheduled' then
    raise exception 'record_inspection requires status inspection_scheduled, current status is %', v_application.status;
  end if;

  v_ai_estimate := (v_application.valuation_snapshot ->> 'estimate')::numeric;
  if p_confirmed_value is distinct from v_ai_estimate
     and (p_value_adjust_reason is null or pg_catalog.btrim(p_value_adjust_reason) = '') then
    raise exception 'an adjustment reason is required when confirmed value differs from the AI estimate'
      using errcode = '22023';
  end if;

  update public.applications
  set status = 'inspected', unit_type_confirmed = p_unit_type_confirmed,
      condition = p_condition, confirmed_value = p_confirmed_value,
      value_adjust_reason = nullif(pg_catalog.btrim(p_value_adjust_reason), '')
  where id = p_application_id returning * into v_application;
  perform private.write_application_event(
    p_application_id, v_actor_id, 'admin', 'inspection_scheduled', 'inspected',
    'record_inspection', nullif(pg_catalog.btrim(p_value_adjust_reason), ''),
    p_note,
    coalesce(p_payload, '{}'::jsonb) || pg_catalog.jsonb_build_object(
      'unit_type_confirmed', p_unit_type_confirmed,
      'condition', p_condition,
      'confirmed_value', p_confirmed_value
    )
  );
  return v_application;
end;
$$;

create or replace function public.issue_offer(
  p_application_id uuid,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_application public.applications%rowtype;
  v_offer numeric;
  v_month date := pg_catalog.date_trunc('month', pg_catalog.now())::date;
begin
  perform private.expire_offers_internal();
  if v_actor_id is null or not (select private.is_admin()) then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  select applications.* into v_application from public.applications
  where applications.id = p_application_id for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  if v_application.status <> 'inspected' then
    raise exception 'issue_offer requires status inspected, current status is %', v_application.status;
  end if;
  if v_application.confirmed_value is null or v_application.confirmed_value <= 0 then
    raise exception 'confirmed market value is required before issuing an offer' using errcode = '22023';
  end if;
  v_offer := private.application_offer(v_application.plan, v_application.confirmed_value);
  perform private.check_monthly_limit(p_application_id, v_application.plan, v_offer, v_month);

  update public.applications
  set status = 'offer_sent', offer_amount = v_offer,
      offer_sent_at = pg_catalog.now(),
      offer_expires_at = pg_catalog.now() + interval '14 days'
  where id = p_application_id returning * into v_application;
  perform private.write_application_event(
    p_application_id, v_actor_id, 'admin', 'inspected', 'offer_sent',
    'issue_offer', null, p_note,
    coalesce(p_payload, '{}'::jsonb) || pg_catalog.jsonb_build_object(
      'plan', v_application.plan,
      'confirmed_value', v_application.confirmed_value,
      'offer_amount', v_offer,
      'offer_expires_at', v_application.offer_expires_at
    )
  );
  return v_application;
end;
$$;

create or replace function public.request_review(
  p_application_id uuid,
  p_reason text,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare v_actor_id uuid := (select auth.uid()); v_application public.applications%rowtype;
begin
  perform private.expire_offers_internal();
  select applications.* into v_application from public.applications
  where applications.id = p_application_id for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  if v_actor_id is null or v_application.user_id <> v_actor_id then
    raise exception 'application owner access required' using errcode = '42501';
  end if;
  if v_application.status = 'expired' then return v_application; end if;
  if v_application.status <> 'offer_sent' then
    raise exception 'request_review requires status offer_sent, current status is %', v_application.status;
  end if;
  if v_application.review_count >= 1 then
    raise exception 'formal offer review can only be requested once';
  end if;
  if p_reason is null or pg_catalog.btrim(p_reason) = '' then
    raise exception 'review reason is required' using errcode = '22023';
  end if;
  update public.applications
  set status = 'review_requested', review_count = review_count + 1
  where id = p_application_id returning * into v_application;
  perform private.write_application_event(
    p_application_id, v_actor_id, 'owner', 'offer_sent', 'review_requested',
    'request_review', pg_catalog.btrim(p_reason), p_note, p_payload
  );
  return v_application;
end;
$$;

create or replace function public.respond_review(
  p_application_id uuid,
  p_keep_offer boolean,
  p_reason text,
  p_confirmed_value numeric default null,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_application public.applications%rowtype;
  v_confirmed_value numeric;
  v_offer numeric;
  v_month date := pg_catalog.date_trunc('month', pg_catalog.now())::date;
begin
  perform private.expire_offers_internal();
  if v_actor_id is null or not (select private.is_admin()) then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_keep_offer is null then
    raise exception 'keep-offer decision is required' using errcode = '22023';
  end if;
  if p_reason is null or pg_catalog.btrim(p_reason) = '' then
    raise exception 'review response reason is required' using errcode = '22023';
  end if;
  select applications.* into v_application from public.applications
  where applications.id = p_application_id for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  if v_application.status = 'expired' then return v_application; end if;
  if v_application.status <> 'review_requested' then
    raise exception 'respond_review requires status review_requested, current status is %', v_application.status;
  end if;

  if p_keep_offer then
    v_confirmed_value := v_application.confirmed_value;
  else
    if p_confirmed_value is null or p_confirmed_value <= 0 then
      raise exception 'a positive revised confirmed value is required when revising the offer'
        using errcode = '22023';
    end if;
    v_confirmed_value := p_confirmed_value;
  end if;

  v_offer := private.application_offer(v_application.plan, v_confirmed_value);
  perform private.check_monthly_limit(p_application_id, v_application.plan, v_offer, v_month);
  update public.applications
  set status = 'offer_sent', confirmed_value = v_confirmed_value,
      value_adjust_reason = case
        when p_keep_offer then value_adjust_reason
        else pg_catalog.btrim(p_reason)
      end,
      offer_amount = v_offer, offer_sent_at = pg_catalog.now(),
      offer_expires_at = pg_catalog.now() + interval '14 days'
  where id = p_application_id returning * into v_application;
  perform private.write_application_event(
    p_application_id, v_actor_id, 'admin', 'review_requested', 'offer_sent',
    'respond_review', pg_catalog.btrim(p_reason), p_note,
    coalesce(p_payload, '{}'::jsonb) || pg_catalog.jsonb_build_object(
      'kept_offer', p_keep_offer,
      'confirmed_value', v_confirmed_value,
      'offer_amount', v_offer,
      'offer_expires_at', v_application.offer_expires_at
    )
  );
  return v_application;
end;
$$;

create or replace function public.accept_offer(
  p_application_id uuid,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare v_actor_id uuid := (select auth.uid()); v_application public.applications%rowtype;
begin
  perform private.expire_offers_internal();
  select applications.* into v_application from public.applications
  where applications.id = p_application_id for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  if v_actor_id is null or v_application.user_id <> v_actor_id then
    raise exception 'application owner access required' using errcode = '42501';
  end if;
  if v_application.status = 'expired' then return v_application; end if;
  if v_application.status <> 'offer_sent' then
    raise exception 'accept_offer requires status offer_sent, current status is %', v_application.status;
  end if;
  update public.applications set status = 'accepted'
  where id = p_application_id returning * into v_application;
  perform private.write_application_event(
    p_application_id, v_actor_id, 'owner', 'offer_sent', 'accepted',
    'accept_offer', null, p_note, p_payload
  );
  return v_application;
end;
$$;

create or replace function public.decline_offer(
  p_application_id uuid,
  p_reason text default null,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare v_actor_id uuid := (select auth.uid()); v_application public.applications%rowtype;
begin
  perform private.expire_offers_internal();
  select applications.* into v_application from public.applications
  where applications.id = p_application_id for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  if v_actor_id is null or v_application.user_id <> v_actor_id then
    raise exception 'application owner access required' using errcode = '42501';
  end if;
  if v_application.status = 'expired' then return v_application; end if;
  if v_application.status <> 'offer_sent' then
    raise exception 'decline_offer requires status offer_sent, current status is %', v_application.status;
  end if;
  update public.applications set status = 'declined'
  where id = p_application_id returning * into v_application;
  perform private.write_application_event(
    p_application_id, v_actor_id, 'owner', 'offer_sent', 'declined',
    'decline_offer', nullif(pg_catalog.btrim(p_reason), ''), p_note, p_payload
  );
  return v_application;
end;
$$;

create or replace function public.switch_plan(
  p_application_id uuid,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_application public.applications%rowtype;
  v_from_plan text;
  v_to_plan text;
  v_estimate numeric;
  v_is_sdp boolean;
  v_offer numeric;
  v_month date := pg_catalog.date_trunc('month', pg_catalog.now())::date;
begin
  perform private.expire_offers_internal();
  select applications.* into v_application from public.applications
  where applications.id = p_application_id for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  if v_actor_id is null or v_application.user_id <> v_actor_id then
    raise exception 'application owner access required' using errcode = '42501';
  end if;
  if v_application.status = 'expired' then return v_application; end if;
  if v_application.status <> 'offer_sent' then
    raise exception 'switch_plan requires status offer_sent, current status is %', v_application.status;
  end if;
  if v_application.plan_switch_count >= 1 then
    raise exception 'plan can only be switched once per application';
  end if;

  v_from_plan := v_application.plan;
  v_to_plan := case v_from_plan when 'A' then 'B' else 'A' end;

  if v_from_plan = 'B' then
    v_estimate := (v_application.valuation_snapshot ->> 'estimate')::numeric;
    v_is_sdp := (v_application.valuation_snapshot ->> 'is_sdp')::boolean;
    if not v_is_sdp then
      raise exception 'cannot switch to Plan A: old home is not in an SDP township'
        using errcode = '22023';
    end if;
    if v_estimate > v_application.new_home_price then
      raise exception 'cannot switch to Plan A: old-home valuation exceeds new-home price'
        using errcode = '22023';
    end if;

    update public.applications
    set plan = 'A', plan_switch_count = plan_switch_count + 1,
        status = 'inspection_scheduled', inspection_scheduled_at = null,
        offer_amount = null, offer_sent_at = null, offer_expires_at = null
    where id = p_application_id returning * into v_application;
  else
    if v_application.confirmed_value is null or v_application.confirmed_value <= 0 then
      raise exception 'confirmed market value is required before switching to Plan B'
        using errcode = '22023';
    end if;
    v_offer := private.application_offer('B', v_application.confirmed_value);
    perform private.check_monthly_limit(p_application_id, 'B', v_offer, v_month);
    update public.applications
    set plan = 'B', plan_switch_count = plan_switch_count + 1,
        offer_amount = v_offer, offer_sent_at = pg_catalog.now(),
        offer_expires_at = pg_catalog.now() + interval '14 days'
    where id = p_application_id returning * into v_application;
  end if;

  perform private.write_application_event(
    p_application_id, v_actor_id, 'owner', 'offer_sent', v_application.status,
    'switch_plan', null, p_note,
    coalesce(p_payload, '{}'::jsonb) || pg_catalog.jsonb_build_object(
      'from_plan', v_from_plan,
      'to_plan', v_to_plan,
      'offer_amount', v_application.offer_amount,
      'offer_expires_at', v_application.offer_expires_at
    )
  );
  return v_application;
end;
$$;

create or replace function public.reject_application(
  p_application_id uuid,
  p_reason text,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare v_actor_id uuid := (select auth.uid()); v_application public.applications%rowtype; v_from_status text;
begin
  if v_actor_id is null or not (select private.is_admin()) then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_reason is null or pg_catalog.btrim(p_reason) = '' then
    raise exception 'rejection reason is required' using errcode = '22023';
  end if;
  select applications.* into v_application from public.applications
  where applications.id = p_application_id for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  if v_application.status not in ('under_review', 'inspected') then
    raise exception 'reject_application requires status under_review or inspected, current status is %', v_application.status;
  end if;
  v_from_status := v_application.status;
  update public.applications
  set status = 'rejected', reject_reason = pg_catalog.btrim(p_reason)
  where id = p_application_id returning * into v_application;
  perform private.write_application_event(
    p_application_id, v_actor_id, 'admin', v_from_status, 'rejected',
    'reject_application', pg_catalog.btrim(p_reason), p_note, p_payload
  );
  return v_application;
end;
$$;

create or replace function public.mark_espa_signed(
  p_application_id uuid,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare v_actor_id uuid := (select auth.uid()); v_application public.applications%rowtype;
begin
  select applications.* into v_application from public.applications
  where applications.id = p_application_id for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  if v_actor_id is null or v_application.user_id <> v_actor_id then
    raise exception 'application owner access required' using errcode = '42501';
  end if;
  if v_application.status <> 'accepted' then
    raise exception 'mark_espa_signed requires status accepted, current status is %', v_application.status;
  end if;
  update public.applications
  set status = 'espa_signed', espa_signed_at = pg_catalog.now(),
      espa_confirmed_at = null, espa_confirmed_by = null
  where id = p_application_id returning * into v_application;
  perform private.write_application_event(
    p_application_id, v_actor_id, 'owner', 'accepted', 'espa_signed',
    'mark_espa_signed', null, p_note, p_payload
  );
  return v_application;
end;
$$;

create or replace function public.confirm_espa(
  p_application_id uuid,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare v_actor_id uuid := (select auth.uid()); v_application public.applications%rowtype;
begin
  if v_actor_id is null or not (select private.is_admin()) then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  select applications.* into v_application from public.applications
  where applications.id = p_application_id for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  if v_application.status <> 'espa_signed' then
    raise exception 'confirm_espa requires status espa_signed, current status is %', v_application.status;
  end if;
  if v_application.espa_confirmed_at is not null then
    raise exception 'e-SPA has already been confirmed';
  end if;
  update public.applications
  set espa_confirmed_at = pg_catalog.now(), espa_confirmed_by = v_actor_id
  where id = p_application_id returning * into v_application;
  perform private.write_application_event(
    p_application_id, v_actor_id, 'admin', 'espa_signed', 'espa_signed',
    'confirm_espa', null, p_note, p_payload
  );
  return v_application;
end;
$$;

create or replace function public.mark_listed(
  p_application_id uuid,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare v_actor_id uuid := (select auth.uid()); v_application public.applications%rowtype;
begin
  if v_actor_id is null or not (select private.is_admin()) then raise exception 'admin access required' using errcode = '42501'; end if;
  select applications.* into v_application from public.applications where applications.id = p_application_id for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  if v_application.espa_confirmed_at is null then raise exception 'admin must confirm the e-SPA before post-acceptance tracking'; end if;
  if v_application.plan <> 'B' or v_application.status <> 'espa_signed' then
    raise exception 'mark_listed requires a confirmed Plan B application in status espa_signed';
  end if;
  update public.applications set status = 'listed' where id = p_application_id returning * into v_application;
  perform private.write_application_event(p_application_id, v_actor_id, 'admin', 'espa_signed', 'listed', 'mark_listed', null, p_note, p_payload);
  return v_application;
end;
$$;

create or replace function public.mark_buyer_found(
  p_application_id uuid,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare v_actor_id uuid := (select auth.uid()); v_application public.applications%rowtype;
begin
  if v_actor_id is null or not (select private.is_admin()) then raise exception 'admin access required' using errcode = '42501'; end if;
  select applications.* into v_application from public.applications where applications.id = p_application_id for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  if v_application.espa_confirmed_at is null then raise exception 'admin must confirm the e-SPA before post-acceptance tracking'; end if;
  if v_application.plan <> 'B' or v_application.status <> 'listed' then
    raise exception 'mark_buyer_found requires a confirmed Plan B application in status listed';
  end if;
  update public.applications set status = 'buyer_found' where id = p_application_id returning * into v_application;
  perform private.write_application_event(p_application_id, v_actor_id, 'admin', 'listed', 'buyer_found', 'mark_buyer_found', null, p_note, p_payload);
  return v_application;
end;
$$;

create or replace function public.mark_guarantee_triggered(
  p_application_id uuid,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare v_actor_id uuid := (select auth.uid()); v_application public.applications%rowtype;
begin
  if v_actor_id is null or not (select private.is_admin()) then raise exception 'admin access required' using errcode = '42501'; end if;
  select applications.* into v_application from public.applications where applications.id = p_application_id for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  if v_application.espa_confirmed_at is null then raise exception 'admin must confirm the e-SPA before post-acceptance tracking'; end if;
  if v_application.plan <> 'B' or v_application.status <> 'listed' then
    raise exception 'mark_guarantee_triggered requires a confirmed Plan B application in status listed';
  end if;
  update public.applications set status = 'guarantee_triggered' where id = p_application_id returning * into v_application;
  perform private.write_application_event(p_application_id, v_actor_id, 'admin', 'listed', 'guarantee_triggered', 'mark_guarantee_triggered', null, p_note, p_payload);
  return v_application;
end;
$$;

create or replace function public.mark_old_home_completed(
  p_application_id uuid,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare v_actor_id uuid := (select auth.uid()); v_application public.applications%rowtype; v_from_status text;
begin
  if v_actor_id is null or not (select private.is_admin()) then raise exception 'admin access required' using errcode = '42501'; end if;
  select applications.* into v_application from public.applications where applications.id = p_application_id for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  if v_application.espa_confirmed_at is null then raise exception 'admin must confirm the e-SPA before post-acceptance tracking'; end if;
  if (v_application.plan = 'A' and v_application.status <> 'espa_signed')
     or (v_application.plan = 'B' and v_application.status not in ('buyer_found', 'guarantee_triggered')) then
    raise exception 'mark_old_home_completed requires confirmed Plan A espa_signed or Plan B buyer_found/guarantee_triggered status';
  end if;
  v_from_status := v_application.status;
  update public.applications set status = 'old_home_completed' where id = p_application_id returning * into v_application;
  perform private.write_application_event(p_application_id, v_actor_id, 'admin', v_from_status, 'old_home_completed', 'mark_old_home_completed', null, p_note, p_payload);
  return v_application;
end;
$$;

create or replace function public.mark_handover(
  p_application_id uuid,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql security definer set search_path = ''
as $$
declare v_actor_id uuid := (select auth.uid()); v_application public.applications%rowtype;
begin
  if v_actor_id is null or not (select private.is_admin()) then raise exception 'admin access required' using errcode = '42501'; end if;
  select applications.* into v_application from public.applications where applications.id = p_application_id for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  if v_application.espa_confirmed_at is null then raise exception 'admin must confirm the e-SPA before post-acceptance tracking'; end if;
  if v_application.status <> 'old_home_completed' then
    raise exception 'mark_handover requires status old_home_completed, current status is %', v_application.status;
  end if;
  update public.applications set status = 'handover' where id = p_application_id returning * into v_application;
  perform private.write_application_event(p_application_id, v_actor_id, 'admin', 'old_home_completed', 'handover', 'mark_handover', null, p_note, p_payload);
  return v_application;
end;
$$;

create or replace function public.admin_application_flags()
returns table (
  application_id uuid,
  valuation_gap boolean,
  low_confidence boolean,
  quota_near boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.expire_offers_internal();
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  return query
  select
    applications.id,
    coalesce(
      applications.confirmed_value
        < ((applications.valuation_snapshot ->> 'low')::numeric * 0.90::numeric),
      false
    ) as valuation_gap,
    coalesce(applications.valuation_snapshot ->> 'confidence' = 'low', false)
      as low_confidence,
    case applications.plan
      when 'A' then limits.plan_a_limit is not null
        and usage.plan_a_used >= limits.plan_a_limit * 0.80::numeric
      when 'B' then limits.plan_b_limit is not null
        and usage.plan_b_used >= limits.plan_b_limit * 0.80::numeric
      else false
    end as quota_near
  from public.applications
  left join public.monthly_limits as limits
    on limits.month = coalesce(
      pg_catalog.date_trunc('month', applications.offer_sent_at)::date,
      pg_catalog.date_trunc('month', pg_catalog.now())::date
    )
  left join lateral (
    select
      coalesce(pg_catalog.sum(active.offer_amount) filter (where active.plan = 'A'), 0) as plan_a_used,
      coalesce(pg_catalog.sum(active.offer_amount) filter (where active.plan = 'B'), 0) as plan_b_used
    from public.applications as active
    where active.offer_sent_at is not null
      and active.offer_amount is not null
      and pg_catalog.date_trunc('month', active.offer_sent_at)::date = limits.month
      and active.status in (
        'offer_sent', 'review_requested', 'accepted', 'espa_signed', 'listed',
        'buyer_found', 'guarantee_triggered', 'old_home_completed', 'handover'
      )
  ) as usage on true;
end;
$$;

drop policy if exists "Owners can submit their own applications"
  on public.applications;
drop policy if exists "Admins can update all applications"
  on public.applications;
drop policy if exists "Owners and admins can append application events"
  on public.application_events;

revoke insert, update, delete on table public.applications from authenticated;
revoke insert, update, delete on table public.application_events from authenticated;
revoke insert (
  user_id,
  valuation_id,
  launch_id,
  unit_type,
  plan,
  new_home_price,
  new_home_price_source,
  address_line,
  postcode,
  title_no,
  pdpa_consent
) on public.applications from authenticated;
revoke insert (
  application_id,
  actor_id,
  actor_role,
  from_status,
  to_status,
  action,
  note
) on public.application_events from authenticated;
revoke usage, select on sequence public.application_events_id_seq from authenticated;
grant select on table public.applications, public.application_events to authenticated;

do $$
declare
  v_signature text;
begin
  for v_signature in
    select pg_catalog.format(
      '%I.%I(%s)',
      namespaces.nspname,
      routines.proname,
      pg_catalog.pg_get_function_identity_arguments(routines.oid)
    )
    from pg_catalog.pg_proc as routines
    join pg_catalog.pg_namespace as namespaces
      on namespaces.oid = routines.pronamespace
    where namespaces.nspname = 'public'
      and routines.proname = any (array[
        'expire_offers',
        'submit_application',
        'start_review',
        'request_info',
        'provide_info',
        'send_indicative',
        'proceed_application',
        'withdraw_application',
        'schedule_inspection',
        'record_inspection',
        'issue_offer',
        'request_review',
        'respond_review',
        'accept_offer',
        'decline_offer',
        'switch_plan',
        'reject_application',
        'mark_espa_signed',
        'confirm_espa',
        'mark_listed',
        'mark_buyer_found',
        'mark_guarantee_triggered',
        'mark_old_home_completed',
        'mark_handover',
        'admin_application_flags'
      ]::text[])
  loop
    execute pg_catalog.format(
      'revoke execute on function %s from public, anon, authenticated, service_role',
      v_signature
    );
    execute pg_catalog.format(
      'grant execute on function %s to authenticated',
      v_signature
    );
  end loop;
end;
$$;

do $$
begin
  if exists (
    select 1 from pg_catalog.pg_extension where extname = 'pg_cron'
  ) and pg_catalog.to_regprocedure('cron.schedule(text,text,text)') is not null then
    execute $cron$
      select cron.schedule(
        'homeloop-expire-offers-daily',
        '5 0 * * *',
        'select public.expire_offers();'
      )
    $cron$;
  end if;
end;
$$;

comment on column public.applications.valuation_snapshot is
  'Indicative valuation snapshot supplied by the trusted Next.js server; admin re-verifies at inspection.';
comment on column public.applications.plan_quote_snapshot is
  'Indicative B3 plan quote snapshot supplied by the trusted Next.js server.';
comment on column public.applications.info_return_status is
  'Workflow gate to restore after the owner answers an information request.';
comment on column public.applications.plan_switch_count is
  'Formal-offer plan switches consumed; maximum one per application.';
comment on function public.expire_offers() is
  'Expires overdue formal offers. Scheduled daily when pg_cron is installed; all offer RPCs also apply lazy expiry.';
