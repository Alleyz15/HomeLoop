begin;

create function public.reschedule_inspection(
  p_application_id uuid,
  p_scheduled_at timestamptz,
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
  v_previous_scheduled_at timestamptz;
begin
  if v_actor_id is null or not (select private.is_admin()) then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_scheduled_at is null
     or not pg_catalog.isfinite(p_scheduled_at)
     or p_scheduled_at <= pg_catalog.now() then
    raise exception 'new inspection schedule must be in the future'
      using errcode = '22023';
  end if;

  select applications.* into v_application
  from public.applications
  where applications.id = p_application_id
  for update;

  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;
  if v_application.status <> 'inspection_scheduled' then
    raise exception 'reschedule_inspection requires status inspection_scheduled, current status is %',
      v_application.status using errcode = '22023';
  end if;
  if v_application.inspection_scheduled_at is null then
    raise exception 'an existing inspection appointment is required before rescheduling'
      using errcode = '22023';
  end if;
  if v_application.inspection_scheduled_at = p_scheduled_at then
    raise exception 'new inspection schedule must differ from the current appointment'
      using errcode = '22023';
  end if;

  v_previous_scheduled_at := v_application.inspection_scheduled_at;

  update public.applications
  set inspection_scheduled_at = p_scheduled_at
  where id = p_application_id
  returning * into v_application;

  perform private.write_application_event(
    p_application_id, v_actor_id, 'admin', 'inspection_scheduled',
    'inspection_scheduled', 'reschedule_inspection', null, p_note,
    coalesce(p_payload, '{}'::jsonb) || pg_catalog.jsonb_build_object(
      'previous_scheduled_at', v_previous_scheduled_at,
      'scheduled_at', p_scheduled_at
    )
  );

  return v_application;
end;
$$;

revoke all on function public.reschedule_inspection(uuid,timestamptz,text,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.reschedule_inspection(uuid,timestamptz,text,jsonb)
  to authenticated;

comment on function public.reschedule_inspection(uuid,timestamptz,text,jsonb)
  is 'Admin-only same-stage action that changes an existing future inspection appointment and preserves both dates in application_events.';
comment on function private.application_offer(text,numeric)
  is 'Authoritative formal-offer formula. Keep Plan A 0.785 and Plan B 0.75 in parity with services/valuation/app/plans/constants.py and its contract test.';

commit;
