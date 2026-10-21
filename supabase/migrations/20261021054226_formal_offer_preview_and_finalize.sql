-- Complete the formal-offer path without changing the financial formulas.
-- Admins first read an authoritative preview, then finalize that exact revision.

create or replace function private.is_positive_finite_numeric(p_value numeric)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_value is not null
    and p_value > 0
    and p_value::text not in ('NaN', 'Infinity', '-Infinity');
$$;

revoke all on function private.is_positive_finite_numeric(numeric)
  from public, anon, authenticated, service_role;

create or replace function private.formal_offer_case_revision(
  p_application public.applications,
  p_operation text,
  p_confirmed_value numeric
)
returns text
language sql
stable
set search_path = ''
as $$
  select pg_catalog.md5(
    pg_catalog.jsonb_build_array(
      p_application.id,
      p_application.updated_at,
      p_application.status,
      p_application.plan,
      p_application.new_home_price,
      p_application.new_home_price_source,
      p_application.confirmed_value,
      p_application.manual_valuation_required,
      p_application.manual_valuation_resolved_at,
      p_application.offer_amount,
      p_application.offer_sent_at,
      p_application.offer_expires_at,
      p_application.review_count,
      p_application.plan_switch_count,
      p_application.valuation_snapshot ->> 'is_sdp',
      (
        select pg_catalog.max(application_events.id)
        from public.application_events
        where application_events.application_id = p_application.id
      ),
      p_operation,
      p_confirmed_value,
      pg_catalog.date_trunc(
        'month', pg_catalog.now() at time zone 'Asia/Kuala_Lumpur'
      )::date
    )::text
  );
$$;

revoke all on function private.formal_offer_case_revision(
  public.applications, text, numeric
) from public, anon, authenticated, service_role;

-- Bind Plan B initial figures to the immutable quote snapshot saved at submit
-- time.  The browser supplies a receipt for audit display, but the database
-- locks the case and verifies every receipt field against its own snapshot.
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
  v_quote jsonb;
  v_plan_b jsonb;
  v_receipt jsonb;
  v_saved_price numeric;
  v_saved_low numeric;
  v_saved_high numeric;
  v_saved_floor numeric;
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
  if not private.is_positive_finite_numeric(p_indicative_low)
     or not private.is_positive_finite_numeric(p_indicative_high)
     or p_indicative_low > p_indicative_high then
    raise exception 'indicative range must be positive with low not greater than high'
      using errcode = '22023';
  end if;
  if v_application.status <> 'under_review' then
    raise exception 'send_indicative requires status under_review, current status is %',
      v_application.status;
  end if;

  if v_application.plan = 'B' then
    if v_application.plan_switch_count <> 0 then
      raise exception 'Plan B initial figures require the original saved quote'
        using errcode = '22023';
    end if;

    v_quote := v_application.plan_quote_snapshot;
    v_plan_b := v_quote -> 'plan_b';
    v_receipt := coalesce(p_payload, '{}'::jsonb) -> 'initial_figures_receipt';

    if pg_catalog.jsonb_typeof(v_quote) <> 'object'
       or pg_catalog.jsonb_typeof(v_quote -> 'new_home') <> 'object'
       or pg_catalog.jsonb_typeof(v_plan_b) <> 'object'
       or pg_catalog.jsonb_typeof(v_quote -> 'new_home' -> 'price') <> 'number'
       or pg_catalog.jsonb_typeof(v_plan_b -> 'eligible') <> 'boolean'
       or (v_plan_b ->> 'eligible')::boolean is not true
       or pg_catalog.jsonb_typeof(v_plan_b -> 'expected_net_low') <> 'number'
       or pg_catalog.jsonb_typeof(v_plan_b -> 'expected_net_high') <> 'number'
       or pg_catalog.jsonb_typeof(v_plan_b -> 'floor') <> 'number'
       or (v_quote ? 'selected_plan' and v_quote ->> 'selected_plan' is distinct from 'B') then
      raise exception 'saved Plan B quote is missing, malformed, ineligible, or does not match the selected plan'
        using errcode = '22023';
    end if;

    v_saved_price := (v_quote -> 'new_home' ->> 'price')::numeric;
    v_saved_low := (v_plan_b ->> 'expected_net_low')::numeric;
    v_saved_high := (v_plan_b ->> 'expected_net_high')::numeric;
    v_saved_floor := (v_plan_b ->> 'floor')::numeric;

    if not private.is_positive_finite_numeric(v_saved_price)
       or v_saved_price is distinct from v_application.new_home_price
       or not private.is_positive_finite_numeric(v_saved_low)
       or not private.is_positive_finite_numeric(v_saved_high)
       or not private.is_positive_finite_numeric(v_saved_floor)
       or v_saved_low > v_saved_high
       or v_saved_low <> pg_catalog.round(v_saved_low)
       or v_saved_high <> pg_catalog.round(v_saved_high)
       or v_saved_floor <> pg_catalog.round(v_saved_floor) then
      raise exception 'saved Plan B quote amounts are invalid or do not match this application'
        using errcode = '22023';
    end if;

    if p_indicative_low is distinct from v_saved_low
       or p_indicative_high is distinct from v_saved_high
       or pg_catalog.jsonb_typeof(v_receipt) <> 'object'
       or v_receipt ->> 'version' is distinct from '1'
       or v_receipt ->> 'plan' is distinct from 'B'
       or v_receipt ->> 'meaning' is distinct from 'expected_open_market_proceeds'
       or v_receipt ->> 'source' is distinct from 'application.plan_quote_snapshot.plan_b'
       or pg_catalog.jsonb_typeof(v_receipt -> 'canonical_low') <> 'number'
       or pg_catalog.jsonb_typeof(v_receipt -> 'canonical_high') <> 'number'
       or pg_catalog.jsonb_typeof(v_receipt -> 'canonical_floor') <> 'number'
       or (v_receipt ->> 'canonical_low')::numeric is distinct from v_saved_low
       or (v_receipt ->> 'canonical_high')::numeric is distinct from v_saved_high
       or (v_receipt ->> 'canonical_floor')::numeric is distinct from v_saved_floor then
      raise exception 'Plan B initial figures and receipt must exactly match the saved quote'
        using errcode = '22023';
    end if;
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

create or replace function public.preview_application_offer(
  p_application_id uuid,
  p_operation text,
  p_revised_confirmed_value numeric default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_application public.applications%rowtype;
  v_confirmed_value numeric;
  v_offer numeric;
  v_month date := pg_catalog.date_trunc(
    'month', pg_catalog.now() at time zone 'Asia/Kuala_Lumpur'
  )::date;
  v_limit numeric;
  v_used numeric := 0;
  v_remaining numeric;
  v_capacity_available boolean := false;
  v_capacity_reason text;
  v_eligible boolean := true;
  v_reason_codes text[] := '{}'::text[];
  v_is_sdp boolean;
  v_offer_kind text;
  v_case_revision text;
begin
  if v_actor_id is null or not (select private.is_admin()) then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_operation not in ('issue', 'keep_review', 'revise_review') then
    raise exception 'operation must be issue, keep_review, or revise_review'
      using errcode = '22023';
  end if;
  if p_operation = 'revise_review' then
    if not private.is_positive_finite_numeric(p_revised_confirmed_value) then
      raise exception 'a positive finite revised confirmed value is required'
        using errcode = '22023';
    end if;
  elsif p_revised_confirmed_value is not null then
    raise exception 'revised confirmed value is only allowed for revise_review'
      using errcode = '22023';
  end if;

  select applications.* into v_application
  from public.applications
  where applications.id = p_application_id;

  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;
  if p_operation = 'issue' and v_application.status <> 'inspected' then
    raise exception 'issue preview requires status inspected, current status is %',
      v_application.status;
  end if;
  if p_operation in ('keep_review', 'revise_review')
     and v_application.status <> 'review_requested' then
    raise exception 'review response preview requires status review_requested, current status is %',
      v_application.status;
  end if;
  if p_operation in ('keep_review', 'revise_review')
     and (
       v_application.offer_expires_at is null
       or v_application.offer_expires_at <= pg_catalog.now()
     ) then
    raise exception 'formal offer deadline is missing or expired; reload the application'
      using errcode = '22023';
  end if;

  v_confirmed_value := case
    when p_operation = 'revise_review' then p_revised_confirmed_value
    else v_application.confirmed_value
  end;
  if not private.is_positive_finite_numeric(v_confirmed_value) then
    raise exception 'confirmed market value is required before previewing an offer'
      using errcode = '22023';
  end if;
  if v_application.manual_valuation_required
     and v_application.manual_valuation_resolved_at is null then
    raise exception 'manual valuation must be resolved before previewing an offer'
      using errcode = '22023';
  end if;

  v_is_sdp := coalesce(
    (v_application.valuation_snapshot ->> 'is_sdp')::boolean,
    false
  );
  if v_application.plan = 'A' and not v_is_sdp then
    v_eligible := false;
    v_reason_codes := pg_catalog.array_append(v_reason_codes, 'not_sdp_township');
  end if;
  if v_application.plan = 'A'
     and v_confirmed_value > v_application.new_home_price then
    v_eligible := false;
    v_reason_codes := pg_catalog.array_append(
      v_reason_codes,
      'confirmed_value_exceeds_new_home_price'
    );
  end if;

  v_offer := private.application_offer(v_application.plan, v_confirmed_value);
  if not private.is_positive_finite_numeric(v_offer) then
    raise exception 'calculated formal offer is invalid' using errcode = '22023';
  end if;
  v_offer_kind := case v_application.plan
    when 'A' then 'formal_purchase_price'
    else 'formal_guarantee_floor'
  end;

  select case v_application.plan
    when 'A' then monthly_limits.plan_a_limit
    else monthly_limits.plan_b_limit
  end
  into v_limit
  from public.monthly_limits
  where monthly_limits.month = v_month;

  if not found then
    v_capacity_reason := 'monthly_limit_not_configured';
  else
    select coalesce(pg_catalog.sum(applications.offer_amount), 0)
    into v_used
    from public.applications
    where applications.id <> p_application_id
      and applications.plan = v_application.plan
      and applications.offer_sent_at is not null
      and pg_catalog.date_trunc(
        'month',
        applications.offer_sent_at at time zone 'Asia/Kuala_Lumpur'
      )::date = v_month
      and applications.offer_amount is not null
      and applications.status in (
        'offer_sent', 'review_requested', 'accepted', 'espa_signed', 'listed',
        'buyer_found', 'guarantee_triggered', 'old_home_completed', 'handover'
      )
      and not (
        applications.status in ('offer_sent', 'review_requested')
        and applications.offer_expires_at is not null
        and applications.offer_expires_at <= pg_catalog.now()
      );

    v_remaining := v_limit - v_used - v_offer;
    v_capacity_available := v_used + v_offer <= v_limit;
    if not v_capacity_available then
      v_capacity_reason := 'monthly_limit_exceeded';
    end if;
  end if;

  v_case_revision := private.formal_offer_case_revision(
    v_application, p_operation, v_confirmed_value
  );

  return pg_catalog.jsonb_build_object(
    'schema_version', 1,
    'application_id', v_application.id,
    'operation', p_operation,
    'plan', v_application.plan,
    'status', v_application.status,
    'case_revision', v_case_revision,
    'confirmed_value_used', v_confirmed_value,
    'saved_new_home_price', v_application.new_home_price,
    'offer_kind', v_offer_kind,
    'offer_amount', v_offer,
    'eligibility', pg_catalog.jsonb_build_object(
      'eligible', v_eligible,
      'reason_codes', pg_catalog.to_jsonb(v_reason_codes)
    ),
    'capacity', pg_catalog.jsonb_build_object(
      'month_myt', v_month,
      'configured_limit', v_limit,
      'used_excluding_application', v_used,
      'proposed_usage', v_used + v_offer,
      'remaining_after', v_remaining,
      'available', v_capacity_available,
      'reason_code', v_capacity_reason
    ),
    'can_finalize', v_eligible and v_capacity_available,
    'checked_at', pg_catalog.now()
  );
end;
$$;

comment on function public.preview_application_offer(uuid, text, numeric) is
  'Read-only admin preview. Finalization rechecks the exact revision, formula, eligibility, and monthly limit under lock.';

create or replace function public.issue_offer_from_preview(
  p_application_id uuid,
  p_expected_case_revision text,
  p_expected_offer_amount numeric,
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
  v_revision text;
  v_is_sdp boolean;
  v_month date := pg_catalog.date_trunc(
    'month', pg_catalog.now() at time zone 'Asia/Kuala_Lumpur'
  )::date;
begin
  if v_actor_id is null or not (select private.is_admin()) then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_expected_case_revision is null
     or pg_catalog.btrim(p_expected_case_revision) = ''
     or not private.is_positive_finite_numeric(p_expected_offer_amount) then
    raise exception 'a valid preview revision and offer amount are required'
      using errcode = '22023';
  end if;

  perform private.expire_offers_internal();

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
  if not private.is_positive_finite_numeric(v_application.confirmed_value) then
    raise exception 'confirmed market value is required before issuing an offer'
      using errcode = '22023';
  end if;
  if v_application.manual_valuation_required
     and v_application.manual_valuation_resolved_at is null then
    raise exception 'manual valuation must be resolved before issuing an offer'
      using errcode = '22023';
  end if;

  v_revision := private.formal_offer_case_revision(
    v_application, 'issue', v_application.confirmed_value
  );
  v_offer := private.application_offer(
    v_application.plan, v_application.confirmed_value
  );
  if v_revision is distinct from p_expected_case_revision
     or v_offer is distinct from p_expected_offer_amount then
    raise exception 'formal offer preview is stale; reload and preview again'
      using errcode = '40001';
  end if;

  if v_application.plan = 'A' then
    v_is_sdp := coalesce(
      (v_application.valuation_snapshot ->> 'is_sdp')::boolean,
      false
    );
    if not v_is_sdp then
      raise exception 'cannot issue Plan A offer: old home is not in an SDP township'
        using errcode = '22023';
    end if;
    if v_application.confirmed_value > v_application.new_home_price then
      raise exception 'cannot issue Plan A offer: confirmed old-home value exceeds new-home price'
        using errcode = '22023';
    end if;
  end if;

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
      'formal_offer_receipt', pg_catalog.jsonb_build_object(
        'version', 1,
        'operation', 'issue',
        'case_revision', p_expected_case_revision,
        'plan', v_application.plan,
        'confirmed_value', v_application.confirmed_value,
        'offer_amount', v_offer,
        'offer_expires_at', v_application.offer_expires_at
      )
    )
  );
  return v_application;
end;
$$;

create or replace function public.respond_review_from_preview(
  p_application_id uuid,
  p_operation text,
  p_expected_case_revision text,
  p_expected_offer_amount numeric,
  p_reason text,
  p_revised_confirmed_value numeric default null,
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
  v_revision text;
  v_is_sdp boolean;
  v_month date := pg_catalog.date_trunc(
    'month', pg_catalog.now() at time zone 'Asia/Kuala_Lumpur'
  )::date;
begin
  if v_actor_id is null or not (select private.is_admin()) then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_operation not in ('keep_review', 'revise_review') then
    raise exception 'operation must be keep_review or revise_review'
      using errcode = '22023';
  end if;
  if p_reason is null or pg_catalog.btrim(p_reason) = '' then
    raise exception 'review response reason is required' using errcode = '22023';
  end if;
  if p_expected_case_revision is null
     or pg_catalog.btrim(p_expected_case_revision) = ''
     or not private.is_positive_finite_numeric(p_expected_offer_amount) then
    raise exception 'a valid preview revision and offer amount are required'
      using errcode = '22023';
  end if;
  if p_operation = 'revise_review' then
    if not private.is_positive_finite_numeric(p_revised_confirmed_value) then
      raise exception 'a positive finite revised confirmed value is required'
        using errcode = '22023';
    end if;
  elsif p_revised_confirmed_value is not null then
    raise exception 'revised confirmed value is only allowed for revise_review'
      using errcode = '22023';
  end if;

  perform private.expire_offers_internal();

  select applications.* into v_application
  from public.applications
  where applications.id = p_application_id
  for update;

  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;
  if v_application.status <> 'review_requested' then
    raise exception 'respond_review requires status review_requested, current status is %',
      v_application.status;
  end if;
  if v_application.offer_expires_at is null
     or v_application.offer_expires_at <= pg_catalog.now() then
    raise exception 'formal offer deadline is missing or expired; reload the application'
      using errcode = '22023';
  end if;

  v_confirmed_value := case
    when p_operation = 'revise_review' then p_revised_confirmed_value
    else v_application.confirmed_value
  end;
  if not private.is_positive_finite_numeric(v_confirmed_value) then
    raise exception 'confirmed market value is required before responding to a review'
      using errcode = '22023';
  end if;

  v_revision := private.formal_offer_case_revision(
    v_application, p_operation, v_confirmed_value
  );
  v_offer := private.application_offer(v_application.plan, v_confirmed_value);
  if v_revision is distinct from p_expected_case_revision
     or v_offer is distinct from p_expected_offer_amount then
    raise exception 'formal offer preview is stale; reload and preview again'
      using errcode = '40001';
  end if;

  if v_application.plan = 'A' then
    v_is_sdp := coalesce(
      (v_application.valuation_snapshot ->> 'is_sdp')::boolean,
      false
    );
    if not v_is_sdp then
      raise exception 'cannot issue Plan A offer: old home is not in an SDP township'
        using errcode = '22023';
    end if;
    if v_confirmed_value > v_application.new_home_price then
      raise exception 'cannot issue Plan A offer: confirmed old-home value exceeds new-home price'
        using errcode = '22023';
    end if;
  end if;

  perform private.check_monthly_limit(
    p_application_id, v_application.plan, v_offer, v_month
  );

  update public.applications
  set status = 'offer_sent',
      confirmed_value = v_confirmed_value,
      value_adjust_reason = case
        when p_operation = 'keep_review' then value_adjust_reason
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
      'formal_offer_receipt', pg_catalog.jsonb_build_object(
        'version', 1,
        'operation', p_operation,
        'case_revision', p_expected_case_revision,
        'plan', v_application.plan,
        'confirmed_value', v_confirmed_value,
        'offer_amount', v_offer,
        'offer_expires_at', v_application.offer_expires_at
      )
    )
  );
  return v_application;
end;
$$;

comment on function public.issue_offer_from_preview(uuid, text, numeric, text, jsonb) is
  'Finalizes the exact admin-reviewed formal offer only if the locked case revision and formula-derived amount still match.';
comment on function public.respond_review_from_preview(uuid, text, text, numeric, text, numeric, text, jsonb) is
  'Keeps or revises a reviewed offer only if the locked case revision and formula-derived amount still match.';

-- The legacy functions trusted a one-step request and can bypass the guarded
-- Preview -> Confirm contract.  Keep them defined for migration compatibility,
-- but remove every API role's ability to invoke them.
revoke all on function public.issue_offer(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.respond_review(uuid, boolean, text, numeric, text, jsonb)
  from public, anon, authenticated, service_role;

revoke all on function public.send_indicative(uuid, numeric, numeric, text, jsonb)
  from public, anon, service_role;
grant execute on function public.send_indicative(uuid, numeric, numeric, text, jsonb)
  to authenticated;

revoke all on function public.preview_application_offer(uuid, text, numeric)
  from public, anon, service_role;
revoke all on function public.issue_offer_from_preview(uuid, text, numeric, text, jsonb)
  from public, anon, service_role;
revoke all on function public.respond_review_from_preview(
  uuid, text, text, numeric, text, numeric, text, jsonb
) from public, anon, service_role;

grant execute on function public.preview_application_offer(uuid, text, numeric)
  to authenticated;
grant execute on function public.issue_offer_from_preview(uuid, text, numeric, text, jsonb)
  to authenticated;
grant execute on function public.respond_review_from_preview(
  uuid, text, text, numeric, text, numeric, text, jsonb
) to authenticated;
