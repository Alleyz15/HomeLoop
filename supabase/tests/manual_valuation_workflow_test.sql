begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_column(
  'public', 'valuation_requests', 'valuation_status',
  'valuation requests persist the valuation API status'
);
select has_column(
  'public', 'applications', 'manual_valuation_required',
  'applications identify the manual valuation path explicitly'
);
select has_column(
  'public', 'applications', 'manual_valuation_resolved_at',
  'manual valuation resolution time is audited'
);
select has_column(
  'public', 'applications', 'manual_valuation_resolved_by',
  'manual valuation resolver is audited'
);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  ('41000000-0000-0000-0000-' || pg_catalog.lpad(test_user::text, 12, '0'))::uuid,
  'authenticated',
  'authenticated',
  'manual-owner-' || test_user || '@example.test',
  'not-a-real-password',
  pg_catalog.now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  pg_catalog.now(),
  pg_catalog.now()
from pg_catalog.generate_series(1, 8) as users(test_user);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '41000000-0000-0000-0000-000000000099',
  'authenticated', 'authenticated', 'manual-admin@example.test',
  'not-a-real-password', pg_catalog.now(),
  '{"provider":"email","providers":["email"]}', '{}',
  pg_catalog.now(), pg_catalog.now()
);

update public.profiles
set role = 'admin'
where id = '41000000-0000-0000-0000-000000000099';

insert into public.sdp_launches (
  id, tier, project, township, price_from_rm, checked_on
)
values (
  92001, 'selling', 'Manual Valuation Test Launch',
  'Test Township', 900000, current_date
);

insert into public.transactions (
  ptype, district, mukim, scheme, road, tenure, land_sqm, floor_sqm,
  price, ym, yr, township, is_sdp, likely_primary
)
select
  '2 - 2 1/2 Storey Terraced', 'PETALING', 'TEST MUKIM',
  'MANUAL SCHEME', 'Jalan Manual 1', 'Freehold', 164, 180,
  700000 + sample_no * 10000, 2026.5, 2026,
  'SDP TEST TOWNSHIP', true, false
from pg_catalog.generate_series(1, 3) as samples(sample_no);

insert into public.transactions (
  ptype, district, mukim, scheme, road, tenure, land_sqm, floor_sqm,
  price, ym, yr, township, is_sdp, likely_primary
)
select
  '2 - 2 1/2 Storey Terraced', 'PETALING', 'TEST MUKIM',
  'ENOUGH DATA SCHEME', 'Jalan Enough 1', 'Freehold', 164, 180,
  700000 + sample_no * 10000, 2026.5, 2026,
  'SDP TEST TOWNSHIP', true, false
from pg_catalog.generate_series(1, 10) as samples(sample_no);

refresh materialized view public.road_catalog;

insert into public.valuation_requests (
  id, user_id, road_norm, scheme, ptype, land_sqm, floor_sqm, tenure,
  estimate, low, high, confidence, valuation_status
)
values
  (
    '42000000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000001',
    'JLN MANUAL 1', 'MANUAL SCHEME', '2 - 2 1/2 Storey Terraced',
    164, 180, 'Freehold', null, null, null, null, 'insufficient_data'
  ),
  (
    '42000000-0000-0000-0000-000000000002',
    '41000000-0000-0000-0000-000000000002',
    'JLN MANUAL 1', 'MANUAL SCHEME', '2 - 2 1/2 Storey Terraced',
    164, 180, 'Freehold', null, null, null, null, 'insufficient_data'
  ),
  (
    '42000000-0000-0000-0000-000000000003',
    '41000000-0000-0000-0000-000000000003',
    'JLN MISSING 1', 'MISSING SCHEME', '2 - 2 1/2 Storey Terraced',
    164, 180, 'Freehold', null, null, null, null, 'not_found'
  ),
  (
    '42000000-0000-0000-0000-000000000004',
    '41000000-0000-0000-0000-000000000004',
    'JLN MANUAL 1', 'MANUAL SCHEME', 'Condominium',
    0, 90, 'Freehold', null, null, null, null, 'unsupported_property_type'
  ),
  (
    '42000000-0000-0000-0000-000000000005',
    '41000000-0000-0000-0000-000000000005',
    'JLN ENOUGH 1', 'ENOUGH DATA SCHEME', '2 - 2 1/2 Storey Terraced',
    164, 180, 'Freehold', null, null, null, null, 'insufficient_data'
  ),
  (
    '42000000-0000-0000-0000-000000000006',
    '41000000-0000-0000-0000-000000000006',
    'JLN MANUAL 1', 'MANUAL SCHEME', '2 - 2 1/2 Storey Terraced',
    164, 180, 'Freehold', 800000, 700000, 900000, 'medium', 'ok'
  );

set local role authenticated;
set local request.jwt.claim.sub = '41000000-0000-0000-0000-000000000001';

select lives_ok(
  $$
    select public.submit_application(
      '42000000-0000-0000-0000-000000000001', 92001, 'Type A', 'A',
      900000, 'from_price', '1, Manual Street', '40150', true,
      '{"status":"insufficient_data","estimate":null,"low":null,"high":null,"confidence":null,"scheme":"MANUAL SCHEME","district":"PETALING","is_sdp":true}',
      null, null
    )
  $$,
  'a legitimate insufficient-data valuation can be submitted without prices'
);

select results_eq(
  $$
    select status, manual_valuation_required, indicative_low, indicative_high,
           plan_quote_snapshot
    from public.applications
    where valuation_id = '42000000-0000-0000-0000-000000000001'
  $$,
  $$values ('submitted'::text, true, null::numeric, null::numeric, null::jsonb)$$,
  'manual submission is explicit and stores no fabricated indicative quote'
);

select throws_ok(
  $$
    select public.submit_application(
      '42000000-0000-0000-0000-000000000001', 92001, 'Type A', 'A',
      900000, 'from_price', '2, Duplicate Street', '40150', true,
      '{"status":"insufficient_data","scheme":"MANUAL SCHEME","district":"PETALING","is_sdp":true}',
      null, null
    )
  $$,
  'P0001', 'You already have an active application',
  'manual submissions preserve the one-active-application restriction'
);

select throws_ok(
  $$
    select public.request_manual_valuation(
      (select id from public.applications where valuation_id = '42000000-0000-0000-0000-000000000001'),
      null, '{}'::jsonb
    )
  $$,
  '42501', 'admin access required',
  'an owner cannot call the admin manual-valuation action'
);

set local request.jwt.claim.sub = '41000000-0000-0000-0000-000000000099';

select lives_ok(
  $$select public.start_review(
    (select id from public.applications where valuation_id = '42000000-0000-0000-0000-000000000001'),
    null, '{}'::jsonb
  )$$,
  'admin can start review for a manual valuation application'
);

select throws_ok(
  $$select public.send_indicative(
    (select id from public.applications where valuation_id = '42000000-0000-0000-0000-000000000001'),
    600000, 700000, null, '{}'::jsonb
  )$$,
  'P0001', 'manual valuation applications cannot receive an indicative range',
  'manual applications cannot receive a pre-inspection RM range'
);

select lives_ok(
  $$select public.request_manual_valuation(
    (select id from public.applications where valuation_id = '42000000-0000-0000-0000-000000000001'),
    'Registered valuation required', '{}'::jsonb
  )$$,
  'admin can request a registered manual valuation after review'
);

select pg_catalog.set_config(
  'test.manual_application_id',
  (
    select id::text
    from public.applications
    where valuation_id = '42000000-0000-0000-0000-000000000001'
  ),
  true
);

set local request.jwt.claim.sub = '41000000-0000-0000-0000-000000000002';

select throws_ok(
  $$select public.proceed_manual_valuation(
    pg_catalog.current_setting('test.manual_application_id')::uuid,
    null, '{}'::jsonb
  )$$,
  '42501', 'application owner access required',
  'another owner cannot consent to a manual valuation'
);

set local request.jwt.claim.sub = '41000000-0000-0000-0000-000000000001';

select lives_ok(
  $$select public.proceed_manual_valuation(
    (select id from public.applications where valuation_id = '42000000-0000-0000-0000-000000000001'),
    'I agree to proceed with a registered valuation', '{}'::jsonb
  )$$,
  'the owner explicitly consents before inspection can be scheduled'
);

set local request.jwt.claim.sub = '41000000-0000-0000-0000-000000000099';

select lives_ok(
  $$select public.schedule_inspection(
    (select id from public.applications where valuation_id = '42000000-0000-0000-0000-000000000001'),
    pg_catalog.now() + interval '2 days', null, '{}'::jsonb
  )$$,
  'admin can schedule inspection only after owner consent'
);

select throws_ok(
  $$select public.record_inspection(
    (select id from public.applications where valuation_id = '42000000-0000-0000-0000-000000000001'),
    true, 'good', 950000, null, null, '{}'::jsonb
  )$$,
  '22023', 'manual valuation basis and registered valuer must be named in the note',
  'manual inspection requires a valuation basis and valuer note'
);

select throws_ok(
  $$select public.record_inspection(
    (select id from public.applications where valuation_id = '42000000-0000-0000-0000-000000000001'),
    true, 'good', 950000, 'AI adjustment', 'Registered valuer: Test Valuer; basis: inspection', '{}'::jsonb
  )$$,
  '22023', 'manual valuation does not use an AI adjustment reason; record the basis and valuer in the note',
  'manual inspection does not accept an AI-adjustment reason'
);

select lives_ok(
  $$select public.record_inspection(
    (select id from public.applications where valuation_id = '42000000-0000-0000-0000-000000000001'),
    true, 'good', 950000, null,
    'Registered valuer: Test Valuer; basis: physical inspection', '{}'::jsonb
  )$$,
  'admin resolves the manual valuation with a positive confirmed value'
);

select results_eq(
  $$
    select status, confirmed_value, value_adjust_reason,
           manual_valuation_resolved_at is not null,
           manual_valuation_resolved_by
    from public.applications
    where valuation_id = '42000000-0000-0000-0000-000000000001'
  $$,
  $$values (
    'inspected'::text, 950000::numeric, null::text, true,
    '41000000-0000-0000-0000-000000000099'::uuid
  )$$,
  'manual resolution is audited without an AI adjustment reason'
);

create temporary table manual_plan_a_issue_preview as
select public.preview_application_offer(
  (select id from public.applications where valuation_id = '42000000-0000-0000-0000-000000000001'),
  'issue', null
) as payload;

select throws_ok(
  $$select public.issue_offer_from_preview(
    (select id from public.applications where valuation_id = '42000000-0000-0000-0000-000000000001'),
    (select payload ->> 'case_revision' from manual_plan_a_issue_preview),
    (select (payload ->> 'offer_amount')::numeric from manual_plan_a_issue_preview),
    null, '{}'::jsonb
  )$$,
  '22023',
  'cannot issue Plan A offer: confirmed old-home value exceeds new-home price',
  'Plan A eligibility is deferred to the confirmed value for manual cases'
);

set local request.jwt.claim.sub = '41000000-0000-0000-0000-000000000001';

select lives_ok(
  $$select public.switch_manual_plan_to_b(
    (select id from public.applications where valuation_id = '42000000-0000-0000-0000-000000000001'),
    'Plan A is ineligible after valuation', '{}'::jsonb
  )$$,
  'owner can correct an ineligible manual Plan A to Plan B before an offer'
);

select results_eq(
  $$
    select plan, status, plan_switch_count, offer_amount
    from public.applications
    where valuation_id = '42000000-0000-0000-0000-000000000001'
  $$,
  $$values ('B'::text, 'inspected'::text, 0, null::numeric)$$,
  'pre-offer manual Plan A correction does not consume the formal switch'
);

set local request.jwt.claim.sub = '41000000-0000-0000-0000-000000000099';

create temporary table manual_plan_b_issue_preview as
select public.preview_application_offer(
  (select id from public.applications where valuation_id = '42000000-0000-0000-0000-000000000001'),
  'issue', null
) as payload;

select lives_ok(
  $$select public.issue_offer_from_preview(
    (select id from public.applications where valuation_id = '42000000-0000-0000-0000-000000000001'),
    (select payload ->> 'case_revision' from manual_plan_b_issue_preview),
    (select (payload ->> 'offer_amount')::numeric from manual_plan_b_issue_preview),
    null, '{}'::jsonb
  )$$,
  'admin can issue the normal Plan B offer after manual valuation resolution'
);

select is(
  (select offer_amount from public.applications where valuation_id = '42000000-0000-0000-0000-000000000001'),
  712500::numeric,
  'the formal Plan B offer is computed from the confirmed manual value'
);

select is(
  (select count(*) from public.application_events where application_id = (
    select id from public.applications where valuation_id = '42000000-0000-0000-0000-000000000001'
  )),
  8::bigint,
  'each successful manual workflow action writes exactly one event'
);

select is(
  (select manual_valuation_required from public.admin_application_flags() where application_id = (
    select id from public.applications where valuation_id = '42000000-0000-0000-0000-000000000001'
  )),
  true,
  'admin flags expose manual valuation requirement'
);

set local request.jwt.claim.sub = '41000000-0000-0000-0000-000000000002';

select lives_ok(
  $$select public.submit_application(
    '42000000-0000-0000-0000-000000000002', 92001, 'Type A', 'B',
    900000, 'from_price', '2, Manual Street', '40150', true,
    '{"status":"insufficient_data","estimate":null,"low":null,"high":null,"confidence":null,"scheme":"MANUAL SCHEME","district":"PETALING","is_sdp":true}',
    null, null
  )$$,
  'a second owner can submit another legitimate manual application'
);

set local request.jwt.claim.sub = '41000000-0000-0000-0000-000000000099';
select lives_ok(
  $$select public.start_review((select id from public.applications where valuation_id = '42000000-0000-0000-0000-000000000002'), null, '{}'::jsonb)$$,
  'admin starts the second manual review'
);
select lives_ok(
  $$select public.request_manual_valuation((select id from public.applications where valuation_id = '42000000-0000-0000-0000-000000000002'), null, '{}'::jsonb)$$,
  'admin requests manual valuation on the second case'
);
set local request.jwt.claim.sub = '41000000-0000-0000-0000-000000000002';
select lives_ok(
  $$select public.withdraw_application((select id from public.applications where valuation_id = '42000000-0000-0000-0000-000000000002'), 'Not proceeding', null, '{}'::jsonb)$$,
  'owner may withdraw instead of consenting to manual valuation'
);

set local request.jwt.claim.sub = '41000000-0000-0000-0000-000000000003';
select throws_ok(
  $$select public.submit_application(
    '42000000-0000-0000-0000-000000000003', 92001, 'Type A', 'B',
    900000, 'from_price', '3, Missing Street', '40150', true,
    '{"status":"not_found","scheme":"MISSING SCHEME","district":"PETALING","is_sdp":false}',
    null, null
  )$$,
  '22023', 'only ok or insufficient_data valuations can be submitted',
  'not-found valuations remain non-submittable'
);

set local request.jwt.claim.sub = '41000000-0000-0000-0000-000000000004';
select throws_ok(
  $$select public.submit_application(
    '42000000-0000-0000-0000-000000000004', 92001, 'Type A', 'B',
    900000, 'from_price', '4, Unsupported Street', '40150', true,
    '{"status":"unsupported_property_type","scheme":"MANUAL SCHEME","district":"PETALING","is_sdp":true}',
    null, null
  )$$,
  '22023', 'only ok or insufficient_data valuations can be submitted',
  'unsupported property types remain non-submittable'
);

set local request.jwt.claim.sub = '41000000-0000-0000-0000-000000000005';
select throws_ok(
  $$select public.submit_application(
    '42000000-0000-0000-0000-000000000005', 92001, 'Type A', 'B',
    900000, 'from_price', '5, Enough Data Street', '40150', true,
    '{"status":"insufficient_data","scheme":"ENOUGH DATA SCHEME","district":"PETALING","is_sdp":true}',
    null, null
  )$$,
  '22023', 'insufficient_data valuation is not supported by the road catalog',
  'an owner cannot forge the manual path when ten recent sales exist'
);

set local request.jwt.claim.sub = '41000000-0000-0000-0000-000000000006';
select lives_ok(
  $$select public.submit_application(
    '42000000-0000-0000-0000-000000000006', 92001, 'Type A', 'B',
    900000, 'from_price', '6, Priced Street', '40150', true,
    '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"medium","scheme":"MANUAL SCHEME","district":"PETALING","is_sdp":true}',
    '{"plan_a":{"offer":628000},"plan_b":{"floor":600000}}', null
  )$$,
  'priced valuation submissions remain supported'
);

reset role;

insert into public.applications (
  id, user_id, valuation_id, launch_id, unit_type, plan,
  new_home_price, new_home_price_source, address_line, postcode,
  pdpa_consent, status, confirmed_value, offer_amount, offer_sent_at,
  offer_expires_at, valuation_snapshot, plan_quote_snapshot,
  manual_valuation_required, manual_valuation_resolved_at,
  manual_valuation_resolved_by
)
values
  (
    '43000000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000007',
    '42000000-0000-0000-0000-000000000001', 92001, 'Type A', 'A',
    900000, 'price_from', '7, Review Street', '40150', true,
    'review_requested', 850000, 667250, pg_catalog.now(),
    pg_catalog.now() + interval '14 days',
    '{"status":"insufficient_data","scheme":"MANUAL SCHEME","district":"PETALING","is_sdp":true}',
    null, true, pg_catalog.now(), '41000000-0000-0000-0000-000000000099'
  ),
  (
    '43000000-0000-0000-0000-000000000002',
    '41000000-0000-0000-0000-000000000008',
    '42000000-0000-0000-0000-000000000001', 92001, 'Type A', 'B',
    900000, 'price_from', '8, Switch Street', '40150', true,
    'offer_sent', 950000, 712500, pg_catalog.now(),
    pg_catalog.now() + interval '14 days',
    '{"status":"insufficient_data","scheme":"MANUAL SCHEME","district":"PETALING","is_sdp":true}',
    null, true, pg_catalog.now(), '41000000-0000-0000-0000-000000000099'
  );

set local role authenticated;
set local request.jwt.claim.sub = '41000000-0000-0000-0000-000000000099';

create temporary table manual_review_preview as
select public.preview_application_offer(
  '43000000-0000-0000-0000-000000000001', 'revise_review', 950000
) as payload;

select throws_ok(
  $$select public.respond_review_from_preview(
    '43000000-0000-0000-0000-000000000001', 'revise_review',
    (select payload ->> 'case_revision' from manual_review_preview),
    (select (payload ->> 'offer_amount')::numeric from manual_review_preview),
    'Revised registered valuation', 950000, null, '{}'::jsonb
  )$$,
  '22023',
  'cannot issue Plan A offer: confirmed old-home value exceeds new-home price',
  'review response rechecks deferred Plan A eligibility'
);

set local request.jwt.claim.sub = '41000000-0000-0000-0000-000000000008';

select throws_ok(
  $$select public.switch_plan('43000000-0000-0000-0000-000000000002', null, '{}'::jsonb)$$,
  '22023',
  'cannot switch to Plan A: confirmed old-home value exceeds new-home price',
  'formal switch to Plan A rechecks the confirmed manual value'
);

select * from finish();
rollback;
