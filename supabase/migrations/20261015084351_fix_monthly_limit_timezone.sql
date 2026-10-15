-- Attribute quota usage to the Malaysian calendar month rather than the
-- Supabase session's UTC month. Function signatures and privileges stay the
-- same as the B4 workflow migration.

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
    and pg_catalog.date_trunc(
      'month',
      applications.offer_sent_at at time zone 'Asia/Kuala_Lumpur'
    )::date = p_month
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
  v_month date := pg_catalog.date_trunc(
    'month', pg_catalog.now() at time zone 'Asia/Kuala_Lumpur'
  )::date;
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
  v_month date := pg_catalog.date_trunc(
    'month', pg_catalog.now() at time zone 'Asia/Kuala_Lumpur'
  )::date;
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

create or replace view public.monthly_limit_usage
with (security_invoker = true)
as
with approved as (
  select
    pg_catalog.date_trunc(
      'month', offer_sent_at at time zone 'Asia/Kuala_Lumpur'
    )::date as month,
    plan,
    pg_catalog.sum(offer_amount) as used_amount
  from public.applications
  where offer_sent_at is not null
    and offer_amount is not null
    and status in (
      'offer_sent',
      'review_requested',
      'accepted',
      'espa_signed',
      'listed',
      'buyer_found',
      'guarantee_triggered',
      'old_home_completed',
      'handover'
    )
  group by pg_catalog.date_trunc(
    'month', offer_sent_at at time zone 'Asia/Kuala_Lumpur'
  )::date, plan
)
select
  monthly_limits.month,
  monthly_limits.plan_a_limit,
  monthly_limits.plan_b_limit,
  coalesce(
    pg_catalog.sum(approved.used_amount) filter (where approved.plan = 'A'), 0
  ) as plan_a_used,
  coalesce(
    pg_catalog.sum(approved.used_amount) filter (where approved.plan = 'B'), 0
  ) as plan_b_used
from public.monthly_limits
left join approved using (month)
group by
  monthly_limits.month,
  monthly_limits.plan_a_limit,
  monthly_limits.plan_b_limit;

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
      pg_catalog.date_trunc(
        'month', applications.offer_sent_at at time zone 'Asia/Kuala_Lumpur'
      )::date,
      pg_catalog.date_trunc(
        'month', pg_catalog.now() at time zone 'Asia/Kuala_Lumpur'
      )::date
    )
  left join lateral (
    select
      coalesce(pg_catalog.sum(active.offer_amount) filter (where active.plan = 'A'), 0) as plan_a_used,
      coalesce(pg_catalog.sum(active.offer_amount) filter (where active.plan = 'B'), 0) as plan_b_used
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

revoke execute on function private.check_monthly_limit(uuid, text, numeric, date)
  from public, anon, authenticated, service_role;

revoke execute on function public.issue_offer(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.respond_review(uuid, boolean, text, numeric, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.switch_plan(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.admin_application_flags()
  from public, anon, authenticated, service_role;

grant execute on function public.issue_offer(uuid, text, jsonb) to authenticated;
grant execute on function public.respond_review(uuid, boolean, text, numeric, text, jsonb) to authenticated;
grant execute on function public.switch_plan(uuid, text, jsonb) to authenticated;
grant execute on function public.admin_application_flags() to authenticated;

revoke all on table public.monthly_limit_usage from public, anon, authenticated;
grant select on table public.monthly_limit_usage to authenticated;
grant all on table public.monthly_limit_usage to service_role;
