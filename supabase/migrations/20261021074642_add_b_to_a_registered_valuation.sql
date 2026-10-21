-- Complete the approved Plan B to Plan A prototype path. The external
-- registered valuer remains outside HomeLoop; an admin records the appointment
-- and resulting value while the owner retains every offer decision.
begin;

create function public.schedule_plan_a_valuation(
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
  v_has_b_to_a_switch boolean;
begin
  if v_actor_id is null or not (select private.is_admin()) then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_scheduled_at is null then
    raise exception 'registered valuation schedule is required' using errcode = '22023';
  end if;

  select applications.* into v_application
  from public.applications
  where applications.id = p_application_id
  for update;

  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;
  if v_application.status <> 'inspection_scheduled'
     or v_application.plan <> 'A'
     or v_application.plan_switch_count <> 1 then
    raise exception 'registered valuation scheduling requires a recorded Plan B to Plan A switch'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.application_events
    where application_id = p_application_id
      and action = 'switch_plan'
      and payload ->> 'from_plan' = 'B'
      and payload ->> 'to_plan' = 'A'
  ) into v_has_b_to_a_switch;

  if not v_has_b_to_a_switch then
    raise exception 'registered valuation scheduling requires a recorded Plan B to Plan A switch'
      using errcode = '22023';
  end if;
  if v_application.inspection_scheduled_at is not null then
    raise exception 'registered valuation appointment is already recorded'
      using errcode = '22023';
  end if;

  update public.applications
  set inspection_scheduled_at = p_scheduled_at
  where id = p_application_id
  returning * into v_application;

  perform private.write_application_event(
    p_application_id, v_actor_id, 'admin', 'inspection_scheduled',
    'inspection_scheduled', 'schedule_plan_a_valuation', null, p_note,
    coalesce(p_payload, '{}'::jsonb) || pg_catalog.jsonb_build_object(
      'scheduled_at', p_scheduled_at,
      'previous_confirmed_value', v_application.confirmed_value,
      'visit_type', 'registered_valuation_after_plan_b_to_a_switch'
    )
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
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_application public.applications%rowtype;
  v_ai_low numeric;
  v_ai_high numeric;
  v_has_ai_range boolean := false;
  v_b_to_a boolean := false;
  v_previous_confirmed_value numeric;
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
  if not private.is_positive_finite_numeric(p_confirmed_value) then
    raise exception 'confirmed market value must be a finite amount greater than zero'
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
    raise exception 'record_inspection requires status inspection_scheduled, current status is %',
      v_application.status;
  end if;

  select exists (
    select 1
    from public.application_events
    where application_id = p_application_id
      and action = 'switch_plan'
      and payload ->> 'from_plan' = 'B'
      and payload ->> 'to_plan' = 'A'
  ) into v_b_to_a;
  v_b_to_a := v_b_to_a
    and v_application.plan = 'A'
    and v_application.plan_switch_count = 1;
  v_previous_confirmed_value := v_application.confirmed_value;

  if v_b_to_a then
    if v_application.inspection_scheduled_at is null then
      raise exception 'schedule the Plan A registered valuation before recording findings'
        using errcode = '22023';
    end if;
    if p_note is null or pg_catalog.btrim(p_note) = '' then
      raise exception 'Plan B to Plan A valuation basis and registered valuer must be named in the note'
        using errcode = '22023';
    end if;
  end if;

  if v_application.manual_valuation_required then
    if p_note is null or pg_catalog.btrim(p_note) = '' then
      raise exception 'manual valuation basis and registered valuer must be named in the note'
        using errcode = '22023';
    end if;
    if p_value_adjust_reason is not null
       and pg_catalog.btrim(p_value_adjust_reason) <> '' then
      raise exception 'manual valuation does not use an AI adjustment reason; record the basis and valuer in the note'
        using errcode = '22023';
    end if;
  else
    if pg_catalog.jsonb_typeof(v_application.valuation_snapshot -> 'low') = 'number'
       and pg_catalog.jsonb_typeof(v_application.valuation_snapshot -> 'high') = 'number' then
      v_ai_low := (v_application.valuation_snapshot ->> 'low')::numeric;
      v_ai_high := (v_application.valuation_snapshot ->> 'high')::numeric;
      v_has_ai_range := private.is_positive_finite_numeric(v_ai_low)
        and private.is_positive_finite_numeric(v_ai_high)
        and v_ai_low <= v_ai_high;
    end if;

    if v_b_to_a
       and p_confirmed_value is distinct from v_previous_confirmed_value
       and (p_value_adjust_reason is null or pg_catalog.btrim(p_value_adjust_reason) = '') then
      raise exception 'an owner-visible explanation is required when the registered value differs from the previous Plan B confirmed value'
        using errcode = '22023';
    end if;

    if (
      not v_has_ai_range
      or p_confirmed_value < v_ai_low
      or p_confirmed_value > v_ai_high
    ) and (
      p_value_adjust_reason is null
      or pg_catalog.btrim(p_value_adjust_reason) = ''
    ) then
      raise exception 'an owner-visible explanation is required when confirmed value is outside the saved AI range'
        using errcode = '22023';
    end if;
  end if;

  update public.applications
  set status = 'inspected',
      unit_type_confirmed = p_unit_type_confirmed,
      condition = p_condition,
      confirmed_value = p_confirmed_value,
      value_adjust_reason = case
        when manual_valuation_required then null
        else nullif(pg_catalog.btrim(p_value_adjust_reason), '')
      end,
      manual_valuation_resolved_at = case
        when manual_valuation_required then pg_catalog.now()
        else manual_valuation_resolved_at
      end,
      manual_valuation_resolved_by = case
        when manual_valuation_required then v_actor_id
        else manual_valuation_resolved_by
      end
  where id = p_application_id
  returning * into v_application;

  perform private.write_application_event(
    p_application_id, v_actor_id, 'admin', 'inspection_scheduled', 'inspected',
    'record_inspection',
    case
      when v_application.manual_valuation_required then null
      else nullif(pg_catalog.btrim(p_value_adjust_reason), '')
    end,
    p_note,
    coalesce(p_payload, '{}'::jsonb) || pg_catalog.jsonb_build_object(
      'unit_type_confirmed', p_unit_type_confirmed,
      'condition', p_condition,
      'confirmed_value', p_confirmed_value,
      'previous_confirmed_value', case when v_b_to_a then v_previous_confirmed_value else null end,
      'plan_b_to_a_registered_valuation', v_b_to_a,
      'manual_valuation_resolved', v_application.manual_valuation_required,
      'saved_ai_low', v_ai_low,
      'saved_ai_high', v_ai_high,
      'inside_saved_ai_range', case
        when v_application.manual_valuation_required or not v_has_ai_range then null
        else p_confirmed_value between v_ai_low and v_ai_high
      end
    )
  );
  return v_application;
end;
$$;

revoke all on function public.schedule_plan_a_valuation(uuid,timestamptz,text,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.schedule_plan_a_valuation(uuid,timestamptz,text,jsonb)
  to authenticated;

revoke all on function public.record_inspection(uuid,boolean,text,numeric,text,text,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.record_inspection(uuid,boolean,text,numeric,text,text,jsonb)
  to authenticated;

comment on function public.schedule_plan_a_valuation(uuid,timestamptz,text,jsonb)
  is 'Admin-only state-machine action for the registered valuation required after an owner switches Plan B to Plan A.';
comment on function public.admin_application_flags()
  is 'Admin-only computed flags. Keep valuation_gap 10% and quota_near 80% thresholds in parity with apps/web/src/lib/admin-applications-model.ts.';

commit;
