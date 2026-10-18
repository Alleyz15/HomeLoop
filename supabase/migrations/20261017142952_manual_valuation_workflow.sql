alter table public.valuation_requests
  add column valuation_status text;

update public.valuation_requests
set valuation_status = case
  when estimate is not null
    and low is not null
    and high is not null
    and low > 0
    and estimate > 0
    and high > 0
    and low <= estimate
    and estimate <= high
    and confidence in ('high', 'medium', 'low')
    then 'ok'
  when estimate is null
    and low is null
    and high is null
    and confidence is null
    and exists (
      select 1
      from public.road_catalog
      where road_catalog.road_norm = valuation_requests.road_norm
        and road_catalog.scheme = valuation_requests.scheme
        and road_catalog.ptype = valuation_requests.ptype
        and road_catalog.n_recent_3y < 10
    )
    then 'insufficient_data'
  else 'not_found'
end;

alter table public.valuation_requests
  alter column valuation_status set default 'not_found',
  alter column valuation_status set not null,
  add constraint valuation_requests_valuation_status_check
    check (valuation_status in (
      'ok',
      'insufficient_data',
      'not_found',
      'unsupported_property_type'
    ));

alter table public.applications
  add column manual_valuation_required boolean not null default false,
  add column manual_valuation_resolved_at timestamptz,
  add column manual_valuation_resolved_by uuid
    references auth.users (id) on delete set null;

alter table public.applications
  drop constraint applications_status_check;

alter table public.applications
  add constraint applications_status_check check (
    status in (
      'submitted',
      'under_review',
      'info_requested',
      'indicative_sent',
      'manual_valuation_pending',
      'owner_proceed',
      'withdrawn',
      'inspection_scheduled',
      'inspected',
      'offer_sent',
      'review_requested',
      'accepted',
      'declined',
      'expired',
      'rejected',
      'espa_signed',
      'listed',
      'buyer_found',
      'guarantee_triggered',
      'old_home_completed',
      'handover'
    )
  ),
  add constraint applications_manual_valuation_resolution_check check (
    (
      manual_valuation_resolved_at is null
      and manual_valuation_resolved_by is null
    )
    or (
      manual_valuation_required
      and manual_valuation_resolved_at is not null
      and manual_valuation_resolved_by is not null
    )
  );

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
  v_valuation public.valuation_requests%rowtype;
  v_application public.applications%rowtype;
  v_estimate numeric;
  v_low numeric;
  v_high numeric;
  v_district text;
  v_catalog_district text;
  v_is_sdp boolean;
  v_catalog_is_sdp boolean;
  v_is_manual boolean;
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

  if pg_catalog.jsonb_typeof(p_valuation_snapshot) <> 'object' then
    raise exception 'valuation snapshot must be a JSON object'
      using errcode = '22023';
  end if;

  select valuation_requests.*
  into v_valuation
  from public.valuation_requests
  where valuation_requests.id = p_valuation_id
    and valuation_requests.user_id = v_actor_id
  for share;

  if not found then
    raise exception 'valuation request not found for the current owner'
      using errcode = '42501';
  end if;

  if v_valuation.valuation_status not in ('ok', 'insufficient_data') then
    raise exception 'only ok or insufficient_data valuations can be submitted'
      using errcode = '22023';
  end if;

  if p_valuation_snapshot ->> 'status' is distinct from v_valuation.valuation_status then
    raise exception 'valuation snapshot status does not match the saved valuation'
      using errcode = '22023';
  end if;

  v_is_manual := v_valuation.valuation_status = 'insufficient_data';

  if pg_catalog.jsonb_typeof(p_valuation_snapshot -> 'is_sdp') <> 'boolean'
     or coalesce(pg_catalog.btrim(p_valuation_snapshot ->> 'scheme'), '') = ''
     or coalesce(pg_catalog.btrim(p_valuation_snapshot ->> 'district'), '') = '' then
    raise exception 'valuation snapshot is missing scheme, district, or is_sdp'
      using errcode = '22023';
  end if;

  begin
    v_is_sdp := (p_valuation_snapshot ->> 'is_sdp')::boolean;
  exception
    when invalid_text_representation then
      raise exception 'valuation snapshot has an invalid is_sdp value'
        using errcode = '22023';
  end;

  if v_is_manual then
    if p_plan_quote_snapshot is not null then
      raise exception 'manual valuation applications must not include a plan quote'
        using errcode = '22023';
    end if;

    if p_valuation_snapshot ->> 'estimate' is not null
       or p_valuation_snapshot ->> 'low' is not null
       or p_valuation_snapshot ->> 'high' is not null
       or p_valuation_snapshot ->> 'confidence' is not null
       or v_valuation.estimate is not null
       or v_valuation.low is not null
       or v_valuation.high is not null
       or v_valuation.confidence is not null then
      raise exception 'insufficient_data valuations must not contain prices or confidence'
        using errcode = '22023';
    end if;

    select
      road_catalog.district,
      road_catalog.is_sdp
    into
      v_catalog_district,
      v_catalog_is_sdp
    from public.road_catalog
    where road_catalog.road_norm = v_valuation.road_norm
      and road_catalog.scheme = v_valuation.scheme
      and road_catalog.ptype = v_valuation.ptype
      and road_catalog.n_recent_3y < 10;

    if not found then
      raise exception 'insufficient_data valuation is not supported by the road catalog'
        using errcode = '22023';
    end if;

    if pg_catalog.upper(pg_catalog.btrim(p_valuation_snapshot ->> 'scheme'))
         <> pg_catalog.upper(pg_catalog.btrim(v_valuation.scheme))
       or pg_catalog.upper(pg_catalog.btrim(p_valuation_snapshot ->> 'district'))
         <> pg_catalog.upper(pg_catalog.btrim(v_catalog_district))
       or v_is_sdp is distinct from v_catalog_is_sdp then
      raise exception 'manual valuation snapshot does not match the road catalog'
        using errcode = '22023';
    end if;

    v_district := pg_catalog.upper(pg_catalog.btrim(v_catalog_district));
    v_is_sdp := v_catalog_is_sdp;
  else
    if pg_catalog.jsonb_typeof(p_plan_quote_snapshot) <> 'object' then
      raise exception 'priced applications require a plan quote snapshot'
        using errcode = '22023';
    end if;

    if p_valuation_snapshot ->> 'confidence' not in ('high', 'medium', 'low') then
      raise exception 'valuation snapshot is missing a valid confidence'
        using errcode = '22023';
    end if;

    begin
      v_estimate := (p_valuation_snapshot ->> 'estimate')::numeric;
      v_low := (p_valuation_snapshot ->> 'low')::numeric;
      v_high := (p_valuation_snapshot ->> 'high')::numeric;
    exception
      when invalid_text_representation then
        raise exception 'valuation snapshot has invalid numeric values'
          using errcode = '22023';
    end;

    if v_estimate is null or v_low is null or v_high is null
       or v_low <= 0 or v_estimate <= 0 or v_high <= 0
       or not (v_low <= v_estimate and v_estimate <= v_high) then
      raise exception 'valuation snapshot must have positive low <= estimate <= high values'
        using errcode = '22023';
    end if;

    v_district := pg_catalog.upper(pg_catalog.btrim(p_valuation_snapshot ->> 'district'));
  end if;

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

  if p_plan = 'A' and not v_is_manual and v_estimate > p_new_home_price then
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
      plan_quote_snapshot,
      manual_valuation_required
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
      p_plan_quote_snapshot,
      v_is_manual
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
      'new_home_price_source', v_new_home_price_source,
      'valuation_status', v_valuation.valuation_status,
      'manual_valuation_required', v_is_manual
    )
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

  select applications.* into v_application
  from public.applications
  where applications.id = p_application_id
  for update;

  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;
  if v_application.manual_valuation_required then
    raise exception 'manual valuation applications cannot receive an indicative range'
      using errcode = 'P0001';
  end if;
  if p_indicative_low is null or p_indicative_high is null
     or p_indicative_low <= 0 or p_indicative_high <= 0
     or p_indicative_low > p_indicative_high then
    raise exception 'indicative range must be positive with low not greater than high'
      using errcode = '22023';
  end if;
  if v_application.status <> 'under_review' then
    raise exception 'send_indicative requires status under_review, current status is %',
      v_application.status;
  end if;

  update public.applications
  set status = 'indicative_sent',
      indicative_low = p_indicative_low,
      indicative_high = p_indicative_high
  where id = p_application_id
  returning * into v_application;

  perform private.write_application_event(
    p_application_id, v_actor_id, 'admin', 'under_review', 'indicative_sent',
    'send_indicative', null, p_note,
    coalesce(p_payload, '{}'::jsonb) || pg_catalog.jsonb_build_object(
      'indicative_low', p_indicative_low,
      'indicative_high', p_indicative_high
    )
  );
  return v_application;
end;
$$;

create or replace function public.request_manual_valuation(
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
  if not v_application.manual_valuation_required then
    raise exception 'application does not require manual valuation'
      using errcode = 'P0001';
  end if;
  if v_application.status <> 'under_review' then
    raise exception 'request_manual_valuation requires status under_review, current status is %',
      v_application.status;
  end if;

  update public.applications
  set status = 'manual_valuation_pending'
  where id = p_application_id
  returning * into v_application;

  perform private.write_application_event(
    p_application_id, v_actor_id, 'admin', 'under_review',
    'manual_valuation_pending', 'request_manual_valuation', null,
    p_note, p_payload
  );
  return v_application;
end;
$$;

create or replace function public.proceed_manual_valuation(
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
  if not v_application.manual_valuation_required then
    raise exception 'application does not require manual valuation'
      using errcode = 'P0001';
  end if;
  if v_application.status <> 'manual_valuation_pending' then
    raise exception 'proceed_manual_valuation requires status manual_valuation_pending, current status is %',
      v_application.status;
  end if;

  update public.applications
  set status = 'owner_proceed'
  where id = p_application_id
  returning * into v_application;

  perform private.write_application_event(
    p_application_id, v_actor_id, 'owner', 'manual_valuation_pending',
    'owner_proceed', 'proceed_manual_valuation', null, p_note, p_payload
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
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_application public.applications%rowtype;
  v_from_status text;
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
  if v_application.status not in ('indicative_sent', 'manual_valuation_pending') then
    raise exception 'withdraw_application requires status indicative_sent or manual_valuation_pending, current status is %',
      v_application.status;
  end if;

  v_from_status := v_application.status;
  update public.applications
  set status = 'withdrawn'
  where id = p_application_id
  returning * into v_application;

  perform private.write_application_event(
    p_application_id, v_actor_id, 'owner', v_from_status, 'withdrawn',
    'withdraw', nullif(pg_catalog.btrim(p_reason), ''), p_note, p_payload
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
    raise exception 'confirmed market value must be greater than zero'
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
    v_ai_estimate := (v_application.valuation_snapshot ->> 'estimate')::numeric;
    if p_confirmed_value is distinct from v_ai_estimate
       and (p_value_adjust_reason is null or pg_catalog.btrim(p_value_adjust_reason) = '') then
      raise exception 'an adjustment reason is required when confirmed value differs from the AI estimate'
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
      'manual_valuation_resolved', v_application.manual_valuation_required
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
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_application public.applications%rowtype;
  v_offer numeric;
  v_is_sdp boolean;
  v_month date := pg_catalog.date_trunc(
    'month', pg_catalog.now() at time zone 'Asia/Kuala_Lumpur'
  )::date;
begin
  perform private.expire_offers_internal();
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
  if v_application.status <> 'inspected' then
    raise exception 'issue_offer requires status inspected, current status is %',
      v_application.status;
  end if;
  if v_application.confirmed_value is null or v_application.confirmed_value <= 0 then
    raise exception 'confirmed market value is required before issuing an offer'
      using errcode = '22023';
  end if;
  if v_application.manual_valuation_required
     and v_application.manual_valuation_resolved_at is null then
    raise exception 'manual valuation must be resolved before issuing an offer'
      using errcode = '22023';
  end if;

  if v_application.plan = 'A' then
    v_is_sdp := coalesce((v_application.valuation_snapshot ->> 'is_sdp')::boolean, false);
    if not v_is_sdp then
      raise exception 'cannot issue Plan A offer: old home is not in an SDP township'
        using errcode = '22023';
    end if;
    if v_application.confirmed_value > v_application.new_home_price then
      raise exception 'cannot issue Plan A offer: confirmed old-home value exceeds new-home price'
        using errcode = '22023';
    end if;
  end if;

  v_offer := private.application_offer(
    v_application.plan,
    v_application.confirmed_value
  );
  perform private.check_monthly_limit(
    p_application_id, v_application.plan, v_offer, v_month
  );

  update public.applications
  set status = 'offer_sent',
      offer_amount = v_offer,
      offer_sent_at = pg_catalog.now(),
      offer_expires_at = pg_catalog.now() + interval '14 days'
  where id = p_application_id
  returning * into v_application;

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

create or replace function public.respond_review(
  p_application_id uuid,
  p_keep_offer boolean,
  p_reason text,
  p_confirmed_value numeric default null,
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
  v_confirmed_value numeric;
  v_offer numeric;
  v_is_sdp boolean;
  v_month date := pg_catalog.date_trunc(
    'month', pg_catalog.now() at time zone 'Asia/Kuala_Lumpur'
  )::date;
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

  select applications.* into v_application
  from public.applications
  where applications.id = p_application_id
  for update;

  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;
  if v_application.status = 'expired' then
    return v_application;
  end if;
  if v_application.status <> 'review_requested' then
    raise exception 'respond_review requires status review_requested, current status is %',
      v_application.status;
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

  if v_application.plan = 'A' then
    v_is_sdp := coalesce((v_application.valuation_snapshot ->> 'is_sdp')::boolean, false);
    if not v_is_sdp then
      raise exception 'cannot issue Plan A offer: old home is not in an SDP township'
        using errcode = '22023';
    end if;
    if v_confirmed_value > v_application.new_home_price then
      raise exception 'cannot issue Plan A offer: confirmed old-home value exceeds new-home price'
        using errcode = '22023';
    end if;
  end if;

  v_offer := private.application_offer(v_application.plan, v_confirmed_value);
  perform private.check_monthly_limit(
    p_application_id, v_application.plan, v_offer, v_month
  );

  update public.applications
  set status = 'offer_sent',
      confirmed_value = v_confirmed_value,
      value_adjust_reason = case
        when p_keep_offer then value_adjust_reason
        else pg_catalog.btrim(p_reason)
      end,
      offer_amount = v_offer,
      offer_sent_at = pg_catalog.now(),
      offer_expires_at = pg_catalog.now() + interval '14 days'
  where id = p_application_id
  returning * into v_application;

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

create or replace function public.switch_plan(
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
  v_from_plan text;
  v_to_plan text;
  v_is_sdp boolean;
  v_offer numeric;
  v_month date := pg_catalog.date_trunc(
    'month', pg_catalog.now() at time zone 'Asia/Kuala_Lumpur'
  )::date;
begin
  perform private.expire_offers_internal();

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
  if v_application.status = 'expired' then
    return v_application;
  end if;
  if v_application.status <> 'offer_sent' then
    raise exception 'switch_plan requires status offer_sent, current status is %',
      v_application.status;
  end if;
  if v_application.plan_switch_count >= 1 then
    raise exception 'plan can only be switched once per application';
  end if;

  v_from_plan := v_application.plan;
  v_to_plan := case v_from_plan when 'A' then 'B' else 'A' end;

  if v_from_plan = 'B' then
    if v_application.confirmed_value is null or v_application.confirmed_value <= 0 then
      raise exception 'confirmed market value is required before switching to Plan A'
        using errcode = '22023';
    end if;

    v_is_sdp := coalesce((v_application.valuation_snapshot ->> 'is_sdp')::boolean, false);
    if not v_is_sdp then
      raise exception 'cannot switch to Plan A: old home is not in an SDP township'
        using errcode = '22023';
    end if;
    if v_application.confirmed_value > v_application.new_home_price then
      raise exception 'cannot switch to Plan A: confirmed old-home value exceeds new-home price'
        using errcode = '22023';
    end if;

    update public.applications
    set plan = 'A',
        plan_switch_count = plan_switch_count + 1,
        status = 'inspection_scheduled',
        inspection_scheduled_at = null,
        offer_amount = null,
        offer_sent_at = null,
        offer_expires_at = null
    where id = p_application_id
    returning * into v_application;
  else
    if v_application.confirmed_value is null or v_application.confirmed_value <= 0 then
      raise exception 'confirmed market value is required before switching to Plan B'
        using errcode = '22023';
    end if;

    v_offer := private.application_offer('B', v_application.confirmed_value);
    perform private.check_monthly_limit(
      p_application_id, 'B', v_offer, v_month
    );

    update public.applications
    set plan = 'B',
        plan_switch_count = plan_switch_count + 1,
        offer_amount = v_offer,
        offer_sent_at = pg_catalog.now(),
        offer_expires_at = pg_catalog.now() + interval '14 days'
    where id = p_application_id
    returning * into v_application;
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

create or replace function public.switch_manual_plan_to_b(
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
  v_is_sdp boolean;
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
  if not v_application.manual_valuation_required
     or v_application.manual_valuation_resolved_at is null then
    raise exception 'resolved manual valuation is required for this plan correction'
      using errcode = 'P0001';
  end if;
  if v_application.status <> 'inspected' or v_application.plan <> 'A' then
    raise exception 'switch_manual_plan_to_b requires an inspected manual Plan A application'
      using errcode = 'P0001';
  end if;
  if v_application.offer_amount is not null or v_application.offer_sent_at is not null then
    raise exception 'manual plan correction is only available before a formal offer'
      using errcode = 'P0001';
  end if;

  v_is_sdp := coalesce((v_application.valuation_snapshot ->> 'is_sdp')::boolean, false);
  if v_is_sdp
     and v_application.confirmed_value <= v_application.new_home_price then
    raise exception 'Plan A remains eligible; use the formal plan switch after an offer'
      using errcode = 'P0001';
  end if;

  update public.applications
  set plan = 'B'
  where id = p_application_id
  returning * into v_application;

  perform private.write_application_event(
    p_application_id, v_actor_id, 'owner', 'inspected', 'inspected',
    'switch_manual_plan_to_b', null, p_note,
    coalesce(p_payload, '{}'::jsonb) || pg_catalog.jsonb_build_object(
      'from_plan', 'A',
      'to_plan', 'B',
      'plan_switch_count_consumed', false
    )
  );
  return v_application;
end;
$$;

drop function public.admin_application_flags();

create function public.admin_application_flags()
returns table (
  application_id uuid,
  valuation_gap boolean,
  low_confidence boolean,
  quota_near boolean,
  manual_valuation_required boolean
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
    end as quota_near,
    applications.manual_valuation_required
  from public.applications
  left join public.monthly_limits as limits
    on limits.month = coalesce(
      pg_catalog.date_trunc(
        'month', applications.offer_sent_at at time zone 'Asia/Kuala_Lumpur'
      )::date,
      pg_catalog.date_trunc(
        'month', pg_catalog.now() at time zone 'Asia/Kuala_Lumpur'
      )::date
    )
  left join lateral (
    select
      coalesce(pg_catalog.sum(active.offer_amount) filter (where active.plan = 'A'), 0)
        as plan_a_used,
      coalesce(pg_catalog.sum(active.offer_amount) filter (where active.plan = 'B'), 0)
        as plan_b_used
    from public.applications as active
    where active.offer_sent_at is not null
      and active.offer_amount is not null
      and pg_catalog.date_trunc(
        'month', active.offer_sent_at at time zone 'Asia/Kuala_Lumpur'
      )::date = limits.month
      and active.status in (
        'offer_sent', 'review_requested', 'accepted', 'espa_signed', 'listed',
        'buyer_found', 'guarantee_triggered', 'old_home_completed', 'handover'
      )
  ) as usage on true;
end;
$$;

revoke execute on function public.submit_application(
  uuid, bigint, text, text, numeric, text, text, text, boolean, jsonb, jsonb, text
) from public, anon, authenticated, service_role;
revoke execute on function public.send_indicative(uuid, numeric, numeric, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.request_manual_valuation(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.proceed_manual_valuation(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.withdraw_application(uuid, text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.record_inspection(uuid, boolean, text, numeric, text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.issue_offer(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.respond_review(uuid, boolean, text, numeric, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.switch_plan(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.switch_manual_plan_to_b(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.admin_application_flags()
  from public, anon, authenticated, service_role;

grant execute on function public.submit_application(
  uuid, bigint, text, text, numeric, text, text, text, boolean, jsonb, jsonb, text
) to authenticated;
grant execute on function public.send_indicative(uuid, numeric, numeric, text, jsonb)
  to authenticated;
grant execute on function public.request_manual_valuation(uuid, text, jsonb)
  to authenticated;
grant execute on function public.proceed_manual_valuation(uuid, text, jsonb)
  to authenticated;
grant execute on function public.withdraw_application(uuid, text, text, jsonb)
  to authenticated;
grant execute on function public.record_inspection(uuid, boolean, text, numeric, text, text, jsonb)
  to authenticated;
grant execute on function public.issue_offer(uuid, text, jsonb)
  to authenticated;
grant execute on function public.respond_review(uuid, boolean, text, numeric, text, jsonb)
  to authenticated;
grant execute on function public.switch_plan(uuid, text, jsonb)
  to authenticated;
grant execute on function public.switch_manual_plan_to_b(uuid, text, jsonb)
  to authenticated;
grant execute on function public.admin_application_flags()
  to authenticated;

comment on column public.valuation_requests.valuation_status is
  'Valuation API status. Only insufficient_data may use the manual valuation application path.';
comment on column public.applications.manual_valuation_required is
  'True when the application was submitted from a verified insufficient_data valuation.';
comment on column public.applications.manual_valuation_resolved_at is
  'Time a registered-valuer inspection supplied the first confirmed value for a manual case.';
comment on column public.applications.manual_valuation_resolved_by is
  'Admin who recorded the registered-valuer basis and confirmed value for a manual case.';
comment on function public.request_manual_valuation(uuid, text, jsonb) is
  'Admin routes an insufficient-data application to explicit owner consent before inspection.';
comment on function public.proceed_manual_valuation(uuid, text, jsonb) is
  'Owner consents to a registered manual valuation before inspection scheduling.';
comment on function public.switch_manual_plan_to_b(uuid, text, jsonb) is
  'Owner corrects an ineligible manual Plan A to Plan B before a formal offer without consuming the one formal switch.';
