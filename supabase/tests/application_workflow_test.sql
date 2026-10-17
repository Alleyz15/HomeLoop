begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'b4-owner-1@example.test',
    'not-a-real-password',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'b4-owner-2@example.test',
    'not-a-real-password',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'b4-admin@example.test',
    'not-a-real-password',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  );

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  ('10000000-0000-0000-0000-' || pg_catalog.lpad(test_owner::text, 12, '0'))::uuid,
  'authenticated',
  'authenticated',
  'b4-owner-' || test_owner || '@example.test',
  'not-a-real-password',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now()
from pg_catalog.generate_series(4, 14) as owners(test_owner);

update public.profiles
set role = 'admin'
where id = '10000000-0000-0000-0000-000000000003';

insert into public.sdp_launches (
  id,
  tier,
  project,
  township,
  price_from_rm,
  checked_on
)
values
  (91001, 'selling', 'B4 Test Launch', 'Test Township', 900000, current_date),
  (91002, 'upcoming', 'B4 Upcoming Launch', 'Test Township', 800000, current_date);

select results_eq(
  $$
    select month, plan_a_limit, plan_b_limit
    from public.monthly_limits
    where month between date '2027-01-01' and date '2027-06-01'
    order by month
  $$,
  $$
    values
      (date '2027-01-01', 5000000::numeric, 20000000::numeric),
      (date '2027-02-01', 5000000::numeric, 20000000::numeric),
      (date '2027-03-01', 5000000::numeric, 20000000::numeric),
      (date '2027-04-01', 5000000::numeric, 20000000::numeric),
      (date '2027-05-01', 5000000::numeric, 20000000::numeric),
      (date '2027-06-01', 5000000::numeric, 20000000::numeric)
  $$,
  'monthly limits are seeded through June 2027'
);

insert into public.valuation_requests (
  id,
  user_id,
  scheme,
  ptype,
  land_sqm,
  floor_sqm,
  tenure,
  estimate,
  low,
  high,
  confidence,
  valuation_status
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'TEST SCHEME',
    '2 - 2 1/2 Storey Terraced',
    164,
    180,
    'Freehold',
    800000,
    700000,
    900000,
    'low',
    'ok'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'TEST SCHEME',
    '2 - 2 1/2 Storey Terraced',
    164,
    180,
    'Freehold',
    800000,
    700000,
    900000,
    'medium',
    'ok'
  );

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

select lives_ok(
  $$
    select public.submit_application(
      '20000000-0000-0000-0000-000000000001',
      91001,
      'Type A',
      'B',
      900000,
      'price_from',
      '1, Test Street',
      '40150',
      true,
      '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"low","scheme":"TEST SCHEME","district":"PETALING","is_sdp":true}',
      '{"plan_a":{"offer":628000},"plan_b":{"floor":600000}}',
      null
    )
  $$,
  'an owner can submit an eligible application through the RPC'
);

select is(
  (
    select count(*)
    from public.application_events
    where application_id = (
      select id from public.applications
      where valuation_id = '20000000-0000-0000-0000-000000000001'
    )
  ),
  1::bigint,
  'submission writes exactly one event'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';

select lives_ok(
  $$
    select public.submit_application(
      '20000000-0000-0000-0000-000000000002',
      91001,
      'Type A',
      'B',
      900000,
      'from_price',
      '2, Alias Test Street',
      '40150',
      true,
      '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"medium","scheme":"TEST SCHEME","district":"PETALING","is_sdp":true}',
      '{"plan_a":{"offer":628000},"plan_b":{"floor":600000}}',
      null
    )
  $$,
  'submit_application accepts the B3 from_price alias'
);

select is(
  (
    select new_home_price_source
    from public.applications
    where valuation_id = '20000000-0000-0000-0000-000000000002'
  ),
  'price_from',
  'the from_price alias is stored as price_from'
);

select throws_ok(
  $$
    select public.submit_application(
      '20000000-0000-0000-0000-000000000002',
      91001,
      'Type B',
      'B',
      900000,
      'from_price',
      '3, Duplicate Test Street',
      '40150',
      true,
      '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"medium","scheme":"TEST SCHEME","district":"PETALING","is_sdp":true}',
      '{"plan_a":{"offer":628000},"plan_b":{"floor":600000}}',
      null
    )
  $$,
  'P0001',
  'You already have an active application',
  'an owner receives a clear error when another active application exists'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

select throws_ok(
  $$
    update public.applications
    set status = 'accepted'
    where valuation_id = '20000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  'permission denied for table applications',
  'owners have no direct update privilege on applications'
);

select throws_ok(
  $$
    insert into public.application_events (
      application_id, actor_id, actor_role, from_status, to_status, action
    )
    values (
      (select id from public.applications
       where valuation_id = '20000000-0000-0000-0000-000000000001'),
      '10000000-0000-0000-0000-000000000001',
      'owner',
      'submitted',
      'accepted',
      'forged_event'
    )
  $$,
  '42501',
  'permission denied for table application_events',
  'owners cannot forge application events directly'
);

select throws_ok(
  $$
    select public.start_review(
      (select id from public.applications
       where valuation_id = '20000000-0000-0000-0000-000000000001'),
      null,
      '{}'::jsonb
    )
  $$,
  '42501',
  'admin access required',
  'an owner cannot call an admin action'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';

select throws_ok(
  $$
    select public.proceed_application(
      (select id from public.applications
       where valuation_id = '20000000-0000-0000-0000-000000000001'),
      null,
      '{}'::jsonb
    )
  $$,
  'P0002',
  'application not found',
  'an owner cannot act on another owner application'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';

select lives_ok(
  $$
    select public.start_review(
      (select id from public.applications
       where valuation_id = '20000000-0000-0000-0000-000000000001'),
      'Initial review started',
      '{}'::jsonb
    )
  $$,
  'admin can start review'
);

select lives_ok(
  $$
    select public.request_info(
      (select id from public.applications
       where valuation_id = '20000000-0000-0000-0000-000000000001'),
      'Please provide the loan balance',
      null,
      '{}'::jsonb
    )
  $$,
  'admin can request information during initial review'
);

select is(
  (
    select info_return_status
    from public.applications
    where valuation_id = '20000000-0000-0000-0000-000000000001'
  ),
  'under_review',
  'request_info remembers the originating gate'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

select lives_ok(
  $$
    select public.provide_info(
      (select id from public.applications
       where valuation_id = '20000000-0000-0000-0000-000000000001'),
      'Loan balance supplied',
      '{}'::jsonb
    )
  $$,
  'owner can provide requested information'
);

select results_eq(
  $$
    select status, info_return_status
    from public.applications
    where valuation_id = '20000000-0000-0000-0000-000000000001'
  $$,
  $$values ('under_review'::text, null::text)$$,
  'provide_info returns to the originating gate and clears it'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';

select lives_ok(
  $$
    select public.send_indicative(
      (select id from public.applications
       where valuation_id = '20000000-0000-0000-0000-000000000001'),
      525000,
      675000,
      null,
      '{}'::jsonb
    )
  $$,
  'admin can send an indicative range'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

select lives_ok(
  $$
    select public.proceed_application(
      (select id from public.applications
       where valuation_id = '20000000-0000-0000-0000-000000000001'),
      null,
      '{}'::jsonb
    )
  $$,
  'owner can proceed after the indicative range'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';

select lives_ok(
  $$
    select public.schedule_inspection(
      (select id from public.applications
       where valuation_id = '20000000-0000-0000-0000-000000000001'),
      now() + interval '2 days',
      null,
      '{}'::jsonb
    )
  $$,
  'admin can schedule an inspection'
);

select lives_ok(
  $$
    select public.record_inspection(
      (select id from public.applications
       where valuation_id = '20000000-0000-0000-0000-000000000001'),
      true,
      'good',
      800000,
      null,
      null,
      '{}'::jsonb
    )
  $$,
  'admin can record an inspection without an adjustment reason when the value is unchanged'
);

select lives_ok(
  $$
    select public.request_info(
      (select id from public.applications
       where valuation_id = '20000000-0000-0000-0000-000000000001'),
      'Please provide a clearer title copy',
      null,
      '{}'::jsonb
    )
  $$,
  'admin can request information after inspection'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

select lives_ok(
  $$
    select public.provide_info(
      (select id from public.applications
       where valuation_id = '20000000-0000-0000-0000-000000000001'),
      'Title copy supplied',
      '{}'::jsonb
    )
  $$,
  'owner can provide information requested after inspection'
);

select is(
  (
    select status
    from public.applications
    where valuation_id = '20000000-0000-0000-0000-000000000001'
  ),
  'inspected',
  'post-inspection information returns to inspected'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';

select lives_ok(
  $$
    select public.issue_offer(
      (select id from public.applications
       where valuation_id = '20000000-0000-0000-0000-000000000001'),
      null,
      '{}'::jsonb
    )
  $$,
  'admin can issue a formula-derived offer'
);

select is(
  (
    select offer_amount
    from public.applications
    where valuation_id = '20000000-0000-0000-0000-000000000001'
  ),
  600000::numeric,
  'Plan B formal offer is recomputed as confirmed value times 75 percent'
);

select is(
  (
    select count(*)
    from public.application_events
    where application_id = (
      select id from public.applications
      where valuation_id = '20000000-0000-0000-0000-000000000001'
    )
  ),
  11::bigint,
  'each action through initial offer issuance wrote exactly one event'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

select lives_ok(
  $$
    select public.request_review(
      (select id from public.applications
       where valuation_id = '20000000-0000-0000-0000-000000000001'),
      'Please recheck the condition adjustment',
      null,
      '{}'::jsonb
    )
  $$,
  'owner can request one review'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';

select lives_ok(
  $$
    select public.respond_review(
      (select id from public.applications
       where valuation_id = '20000000-0000-0000-0000-000000000001'),
      true,
      'Offer kept after review',
      null,
      null,
      '{}'::jsonb
    )
  $$,
  'admin can keep and resend a reviewed offer'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

select throws_ok(
  $$
    select public.request_review(
      (select id from public.applications
       where valuation_id = '20000000-0000-0000-0000-000000000001'),
      'Try a second review',
      null,
      '{}'::jsonb
    )
  $$,
  'P0001',
  'formal offer review can only be requested once',
  'a second review request is rejected'
);

reset role;
update public.applications
set offer_expires_at = now() - interval '1 minute'
where valuation_id = '20000000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

select is(
  (
    select status
    from public.accept_offer(
      (select id from public.applications
       where valuation_id = '20000000-0000-0000-0000-000000000001'),
      null,
      '{}'::jsonb
    )
  ),
  'expired',
  'an offer action lazily expires a stale offer instead of accepting it'
);

reset role;

insert into public.applications (
  id, user_id, valuation_id, launch_id, unit_type, plan,
  new_home_price, new_home_price_source, address_line, postcode,
  pdpa_consent, status, confirmed_value, offer_amount,
  offer_sent_at, offer_expires_at, valuation_snapshot, plan_quote_snapshot
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000001',
    91001,
    'Type A',
    'A',
    1200000,
    'sales_quote',
    '2, Test Street',
    '40150',
    true,
    'offer_sent',
    1000000,
    785000,
    now(),
    now() + interval '14 days',
    '{"status":"ok","estimate":1000000,"low":900000,"high":1100000,"confidence":"high","scheme":"TEST SCHEME","district":"PETALING","is_sdp":true}',
    '{}'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000001',
    91001,
    'Type A',
    'B',
    1200000,
    'sales_quote',
    '3, Test Street',
    '40150',
    true,
    'offer_sent',
    800000,
    600000,
    now(),
    now() + interval '14 days',
    '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"medium","scheme":"TEST SCHEME","district":"PETALING","is_sdp":true}',
    '{}'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000001',
    91001,
    'Type A',
    'B',
    1200000,
    'sales_quote',
    '4, Test Street',
    '40150',
    true,
    'offer_sent',
    800000,
    600000,
    now(),
    now() + interval '14 days',
    '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"medium","scheme":"TEST SCHEME","district":"PETALING","is_sdp":false}',
    '{}'
  );

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000004';

select lives_ok(
  $$select public.switch_plan('30000000-0000-0000-0000-000000000001', null, '{}'::jsonb)$$,
  'Plan A can switch once to Plan B'
);

select results_eq(
  $$
    select plan, status, offer_amount, plan_switch_count
    from public.applications
    where id = '30000000-0000-0000-0000-000000000001'
  $$,
  $$values ('B'::text, 'offer_sent'::text, 750000::numeric, 1)$$,
  'A to B recomputes the floor, stays offer_sent, and consumes one switch'
);

select throws_ok(
  $$select public.switch_plan('30000000-0000-0000-0000-000000000001', null, '{}'::jsonb)$$,
  'P0001',
  'plan can only be switched once per application',
  'a second plan switch is rejected independently of review_count'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000005';

select lives_ok(
  $$select public.switch_plan('30000000-0000-0000-0000-000000000002', null, '{}'::jsonb)$$,
  'eligible Plan B can switch to Plan A'
);

select results_eq(
  $$
    select plan, status, offer_amount, offer_sent_at, offer_expires_at, plan_switch_count
    from public.applications
    where id = '30000000-0000-0000-0000-000000000002'
  $$,
  $$values ('A'::text, 'inspection_scheduled'::text, null::numeric, null::timestamptz, null::timestamptz, 1)$$,
  'B to A clears offer fields and requires a registered-valuer inspection'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000006';

select throws_ok(
  $$select public.switch_plan('30000000-0000-0000-0000-000000000003', null, '{}'::jsonb)$$,
  '22023',
  'cannot switch to Plan A: old home is not in an SDP township',
  'an ineligible non-SDP home cannot switch from B to A'
);

select is(
  (select plan from public.applications where id = '30000000-0000-0000-0000-000000000003'),
  'B',
  'a failed switch leaves the original plan unchanged'
);

reset role;

insert into public.applications (
  id, user_id, valuation_id, launch_id, unit_type, plan,
  new_home_price, new_home_price_source, address_line, postcode,
  pdpa_consent, status, confirmed_value, valuation_snapshot, plan_quote_snapshot
)
values (
  '30000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000007',
  '20000000-0000-0000-0000-000000000001',
  91001,
  'Type A',
  'A',
  1200000,
  'sales_quote',
  '5, Test Street',
  '40150',
  true,
  'inspected',
  1000000,
  '{"status":"ok","estimate":1000000,"low":900000,"high":1100000,"confidence":"high","scheme":"TEST SCHEME","district":"PETALING","is_sdp":true}',
  '{}'
);

update public.monthly_limits
set plan_a_limit = 100
where month = date_trunc('month', now())::date;

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';

select throws_ok(
  $$select public.issue_offer('30000000-0000-0000-0000-000000000004', null, '{}'::jsonb)$$,
  'P0001',
  'Plan A monthly limit exceeded: RM0 used + RM785000 offer > RM100 limit',
  'monthly limit blocks an offer before any application change'
);

select results_eq(
  $$select status, offer_amount from public.applications where id = '30000000-0000-0000-0000-000000000004'$$,
  $$values ('inspected'::text, null::numeric)$$,
  'a quota failure leaves the inspected application unchanged'
);

reset role;
update public.monthly_limits
set plan_a_limit = 5000000
where month = date_trunc('month', now())::date;

insert into public.applications (
  id, user_id, valuation_id, launch_id, unit_type, plan,
  new_home_price, new_home_price_source, address_line, postcode,
  pdpa_consent, status, confirmed_value, offer_amount,
  offer_sent_at, offer_expires_at, valuation_snapshot, plan_quote_snapshot
)
values (
  '30000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000008',
  '20000000-0000-0000-0000-000000000001',
  91001,
  'Type A',
  'B',
  900000,
  'price_from',
  '6, Test Street',
  '40150',
  true,
  'accepted',
  800000,
  600000,
  now(),
  now() + interval '14 days',
  '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"low","scheme":"TEST SCHEME","district":"PETALING","is_sdp":true}',
  '{}'
);

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000008';

select lives_ok(
  $$select public.mark_espa_signed('30000000-0000-0000-0000-000000000005', null, '{}'::jsonb)$$,
  'owner can mark the e-SPA signed after accepting'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';

select throws_ok(
  $$select public.mark_listed('30000000-0000-0000-0000-000000000005', null, '{}'::jsonb)$$,
  'P0001',
  'admin must confirm the e-SPA before post-acceptance tracking',
  'post-acceptance tracking is blocked before admin e-SPA confirmation'
);

select lives_ok(
  $$select public.confirm_espa('30000000-0000-0000-0000-000000000005', null, '{}'::jsonb)$$,
  'admin can confirm the owner e-SPA marker without changing status'
);

select lives_ok(
  $$select public.mark_listed('30000000-0000-0000-0000-000000000005', null, '{}'::jsonb)$$,
  'admin can mark a confirmed Plan B application listed'
);

select lives_ok(
  $$select public.mark_buyer_found('30000000-0000-0000-0000-000000000005', null, '{}'::jsonb)$$,
  'admin can mark a buyer found'
);

select lives_ok(
  $$select public.mark_old_home_completed('30000000-0000-0000-0000-000000000005', null, '{}'::jsonb)$$,
  'admin can mark the old-home transaction completed'
);

select lives_ok(
  $$select public.mark_handover('30000000-0000-0000-0000-000000000005', null, '{}'::jsonb)$$,
  'admin can mark new-home handover'
);

select results_eq(
  $$
    select status, (espa_confirmed_at is not null), espa_confirmed_by
    from public.applications
    where id = '30000000-0000-0000-0000-000000000005'
  $$,
  $$values ('handover'::text, true, '10000000-0000-0000-0000-000000000003'::uuid)$$,
  'e-SPA confirmation and post-acceptance states are recorded'
);

select is(
  (select count(*) from public.application_events where application_id = '30000000-0000-0000-0000-000000000005'),
  6::bigint,
  'every e-SPA and post-acceptance action writes exactly one event'
);

select is(
  (
    select low_confidence
    from public.admin_application_flags()
    where application_id = '30000000-0000-0000-0000-000000000005'
  ),
  true,
  'admin flags are computed from the valuation snapshot'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

select throws_ok(
  $$select * from public.admin_application_flags()$$,
  '42501',
  'admin access required',
  'owners cannot read admin application flags'
);

reset role;

insert into public.applications (
  id, user_id, valuation_id, launch_id, unit_type, plan,
  new_home_price, new_home_price_source, address_line, postcode,
  pdpa_consent, status, confirmed_value, offer_amount,
  offer_sent_at, offer_expires_at, valuation_snapshot, plan_quote_snapshot,
  espa_signed_at, espa_confirmed_at, espa_confirmed_by
)
values
  (
    '30000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000009',
    '20000000-0000-0000-0000-000000000001',
    91001, 'Type A', 'B', 900000, 'price_from', '7, Test Street', '40150',
    true, 'indicative_sent', null, null, null, null,
    '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"medium","scheme":"TEST SCHEME","district":"PETALING","is_sdp":true}',
    '{}', null, null, null
  ),
  (
    '30000000-0000-0000-0000-000000000007',
    '10000000-0000-0000-0000-000000000010',
    '20000000-0000-0000-0000-000000000001',
    91001, 'Type A', 'B', 900000, 'price_from', '8, Test Street', '40150',
    true, 'offer_sent', 800000, 600000, now(), now() + interval '14 days',
    '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"medium","scheme":"TEST SCHEME","district":"PETALING","is_sdp":true}',
    '{}', null, null, null
  ),
  (
    '30000000-0000-0000-0000-000000000008',
    '10000000-0000-0000-0000-000000000011',
    '20000000-0000-0000-0000-000000000001',
    91001, 'Type A', 'B', 900000, 'price_from', '9, Test Street', '40150',
    true, 'under_review', null, null, null, null,
    '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"medium","scheme":"TEST SCHEME","district":"PETALING","is_sdp":true}',
    '{}', null, null, null
  ),
  (
    '30000000-0000-0000-0000-000000000009',
    '10000000-0000-0000-0000-000000000012',
    '20000000-0000-0000-0000-000000000001',
    91001, 'Type A', 'B', 900000, 'price_from', '10, Test Street', '40150',
    true, 'listed', 800000, 600000, now(), now() + interval '14 days',
    '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"medium","scheme":"TEST SCHEME","district":"PETALING","is_sdp":true}',
    '{}', now(), now(), '10000000-0000-0000-0000-000000000003'
  ),
  (
    '30000000-0000-0000-0000-000000000010',
    '10000000-0000-0000-0000-000000000013',
    '20000000-0000-0000-0000-000000000001',
    91001, 'Type A', 'A', 900000, 'price_from', '11, Test Street', '40150',
    true, 'espa_signed', 800000, 628000, now(), now() + interval '14 days',
    '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"medium","scheme":"TEST SCHEME","district":"PETALING","is_sdp":true}',
    '{}', now(), now(), '10000000-0000-0000-0000-000000000003'
  );

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000009';

select lives_ok(
  $$select public.withdraw_application('30000000-0000-0000-0000-000000000006', 'No longer proceeding', null, '{}'::jsonb)$$,
  'owner can withdraw after the indicative range'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000010';

select lives_ok(
  $$select public.decline_offer('30000000-0000-0000-0000-000000000007', 'Not proceeding', null, '{}'::jsonb)$$,
  'owner can decline a current formal offer'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';

select lives_ok(
  $$select public.reject_application('30000000-0000-0000-0000-000000000008', 'Title issue', null, '{}'::jsonb)$$,
  'admin can reject an application with a reason'
);

select lives_ok(
  $$select public.mark_guarantee_triggered('30000000-0000-0000-0000-000000000009', null, '{}'::jsonb)$$,
  'admin can mark a confirmed listed Plan B guarantee triggered'
);

select lives_ok(
  $$select public.mark_old_home_completed('30000000-0000-0000-0000-000000000010', null, '{}'::jsonb)$$,
  'admin can complete a confirmed Plan A old-home transaction directly after e-SPA'
);

select results_eq(
  $$
    select id, status
    from public.applications
    where id between
      '30000000-0000-0000-0000-000000000006'::uuid
      and '30000000-0000-0000-0000-000000000010'::uuid
    order by id
  $$,
  $$values
    ('30000000-0000-0000-0000-000000000006'::uuid, 'withdrawn'::text),
    ('30000000-0000-0000-0000-000000000007'::uuid, 'declined'::text),
    ('30000000-0000-0000-0000-000000000008'::uuid, 'rejected'::text),
    ('30000000-0000-0000-0000-000000000009'::uuid, 'guarantee_triggered'::text),
    ('30000000-0000-0000-0000-000000000010'::uuid, 'old_home_completed'::text)
  $$,
  'terminal and alternate post-acceptance transitions reach the expected states'
);

select results_eq(
  $$
    select application_id, count(*)
    from public.application_events
    where application_id between
      '30000000-0000-0000-0000-000000000006'::uuid
      and '30000000-0000-0000-0000-000000000010'::uuid
    group by application_id
    order by application_id
  $$,
  $$values
    ('30000000-0000-0000-0000-000000000006'::uuid, 1::bigint),
    ('30000000-0000-0000-0000-000000000007'::uuid, 1::bigint),
    ('30000000-0000-0000-0000-000000000008'::uuid, 1::bigint),
    ('30000000-0000-0000-0000-000000000009'::uuid, 1::bigint),
    ('30000000-0000-0000-0000-000000000010'::uuid, 1::bigint)
  $$,
  'withdraw, decline, reject, guarantee, and Plan A completion each write exactly one event'
);

reset role;

insert into public.applications (
  id, user_id, valuation_id, launch_id, unit_type, plan,
  new_home_price, new_home_price_source, address_line, postcode,
  pdpa_consent, status, confirmed_value, offer_amount,
  offer_sent_at, offer_expires_at, valuation_snapshot, plan_quote_snapshot
)
values (
  '30000000-0000-0000-0000-000000000011',
  '10000000-0000-0000-0000-000000000014',
  '20000000-0000-0000-0000-000000000001',
  91001,
  'Type A',
  'A',
  1200000,
  'sales_quote',
  '12, Test Street',
  '40150',
  true,
  'accepted',
  5100000,
  4000000,
  '2026-10-31 17:00:00+00'::timestamptz,
  '2026-11-14 17:00:00+00'::timestamptz,
  '{"status":"ok","estimate":5100000,"low":4900000,"high":5300000,"confidence":"high","scheme":"TEST SCHEME","district":"PETALING","is_sdp":true}',
  '{}'
);

select is(
  (
    select plan_a_used
    from public.monthly_limit_usage
    where month = '2026-11-01'::date
  ),
  4000000::numeric,
  '2026-11-01 01:00 MYT is attributed to the November monthly usage'
);

select throws_ok(
  $$
    select private.check_monthly_limit(
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      'A',
      1100000,
      '2026-11-01'::date
    )
  $$,
  'P0001',
  'Plan A monthly limit exceeded: RM4000000 used + RM1100000 offer > RM5000000 limit',
  'monthly-limit enforcement counts the MYT boundary offer in November'
);

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';

select is(
  (
    select quota_near
    from public.admin_application_flags()
    where application_id = '30000000-0000-0000-0000-000000000011'
  ),
  true,
  'admin quota-near flag uses the same Kuala Lumpur month boundary'
);

select * from finish();
rollback;
