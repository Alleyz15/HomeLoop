begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('61000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'formal-owner-1@example.test', 'not-a-real-password', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('61000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'formal-owner-2@example.test', 'not-a-real-password', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('61000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'formal-owner-3@example.test', 'not-a-real-password', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('61000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'formal-owner-4@example.test', 'not-a-real-password', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('61000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'formal-owner-5@example.test', 'not-a-real-password', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('61000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'formal-owner-6@example.test', 'not-a-real-password', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('61000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'formal-owner-7@example.test', 'not-a-real-password', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('61000000-0000-0000-0000-000000000099', 'authenticated', 'authenticated', 'formal-admin@example.test', 'not-a-real-password', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update public.profiles set role = 'admin'
where id = '61000000-0000-0000-0000-000000000099';

insert into public.sdp_launches (id, tier, project, township, price_from_rm, checked_on)
values (94001, 'selling', 'Formal Offer Test Launch', 'Test Township', 900000, current_date);

insert into public.valuation_requests (
  id, user_id, scheme, ptype, land_sqm, floor_sqm, tenure,
  estimate, low, high, confidence, valuation_status
)
values
  ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', 'FORMAL TEST', 'Terraced', 164, 180, 'Freehold', 800000, 700000, 900000, 'high', 'ok'),
  ('62000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000002', 'FORMAL TEST', 'Terraced', 164, 180, 'Freehold', 800000, 700000, 900000, 'high', 'ok'),
  ('62000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000003', 'FORMAL TEST', 'Terraced', 164, 180, 'Freehold', 800000, 700000, 900000, 'high', 'ok'),
  ('62000000-0000-0000-0000-000000000004', '61000000-0000-0000-0000-000000000004', 'FORMAL TEST', 'Terraced', 164, 180, 'Freehold', 800000, 700000, 900000, 'high', 'ok'),
  ('62000000-0000-0000-0000-000000000005', '61000000-0000-0000-0000-000000000005', 'FORMAL TEST', 'Terraced', 164, 180, 'Freehold', 800000, 700000, 900000, 'high', 'ok'),
  ('62000000-0000-0000-0000-000000000006', '61000000-0000-0000-0000-000000000006', 'FORMAL TEST', 'Terraced', 164, 180, 'Freehold', 800000, 700000, 900000, 'high', 'ok'),
  ('62000000-0000-0000-0000-000000000007', '61000000-0000-0000-0000-000000000007', 'FORMAL TEST', 'Terraced', 164, 180, 'Freehold', 800000, 700000, 900000, 'high', 'ok');

insert into public.monthly_limits (month, plan_a_limit, plan_b_limit)
values (date_trunc('month', now() at time zone 'Asia/Kuala_Lumpur')::date, 5000000, 20000000)
on conflict (month) do update set plan_a_limit = excluded.plan_a_limit, plan_b_limit = excluded.plan_b_limit;

insert into public.applications (
  id, user_id, valuation_id, launch_id, unit_type, plan,
  new_home_price, new_home_price_source, address_line, postcode,
  pdpa_consent, status, inspection_scheduled_at, confirmed_value,
  offer_amount, offer_sent_at, offer_expires_at, review_count,
  valuation_snapshot, plan_quote_snapshot,
  manual_valuation_required, manual_valuation_resolved_at
)
values
  ('63000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', 94001, 'Type A', 'B', 900000, 'sales_quote', '1 Test Road', '40150', true, 'inspected', now(), 800000, null, null, null, 0, '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"high","is_sdp":true}', '{}', false, null),
  ('63000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000002', 94001, 'Type A', 'B', 900000, 'sales_quote', '2 Test Road', '40150', true, 'inspection_scheduled', now(), null, null, null, null, 0, '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"high","is_sdp":true}', '{}', false, null),
  ('63000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000003', '62000000-0000-0000-0000-000000000003', 94001, 'Type A', 'B', 900000, 'sales_quote', '3 Test Road', '40150', true, 'inspection_scheduled', now(), null, null, null, null, 0, '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"high","is_sdp":true}', '{}', false, null),
  ('63000000-0000-0000-0000-000000000004', '61000000-0000-0000-0000-000000000004', '62000000-0000-0000-0000-000000000004', 94001, 'Type A', 'B', 900000, 'sales_quote', '4 Test Road', '40150', true, 'review_requested', now(), 800000, 600000, now(), now() + interval '14 days', 1, '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"high","is_sdp":true}', '{}', false, null),
  ('63000000-0000-0000-0000-000000000005', '61000000-0000-0000-0000-000000000005', '62000000-0000-0000-0000-000000000005', 94001, 'Type A', 'B', 900000, 'sales_quote', '5 Test Road', '40150', true, 'review_requested', now(), 800000, 600000, now(), now() + interval '14 days', 1, '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"high","is_sdp":true}', '{}', false, null),
  ('63000000-0000-0000-0000-000000000006', '61000000-0000-0000-0000-000000000006', '62000000-0000-0000-0000-000000000006', 94001, 'Type A', 'A', 900000, 'sales_quote', '6 Test Road', '40150', true, 'inspected', now(), 800000.75, null, null, null, 0, '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"high","is_sdp":true}', '{}', false, null),
  ('63000000-0000-0000-0000-000000000007', '61000000-0000-0000-0000-000000000007', '62000000-0000-0000-0000-000000000007', 94001, 'Type A', 'B', 900000, 'sales_quote', '7 Test Road', '40150', true, 'under_review', null, null, null, null, null, 0, '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"high","is_sdp":true}', '{"selected_plan":"B","new_home":{"price":900000},"plan_b":{"eligible":true,"expected_net_low":669200,"expected_net_high":860400,"floor":600000}}', false, null);

set local role authenticated;
set local request.jwt.claim.sub = '61000000-0000-0000-0000-000000000001';

select throws_ok(
  $$select public.preview_application_offer('63000000-0000-0000-0000-000000000001', 'issue', null)$$,
  '42501', 'admin access required', 'owners cannot preview formal offers'
);

set local request.jwt.claim.sub = '61000000-0000-0000-0000-000000000099';

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated', 'public.issue_offer(uuid,text,jsonb)', 'EXECUTE'
  ),
  'authenticated cannot invoke the legacy one-step issue_offer RPC'
);
select ok(
  not pg_catalog.has_function_privilege(
    'authenticated', 'public.respond_review(uuid,boolean,text,numeric,text,jsonb)', 'EXECUTE'
  ),
  'authenticated cannot invoke the legacy one-step respond_review RPC'
);

select lives_ok(
  $$select public.record_inspection('63000000-0000-0000-0000-000000000002', true, 'good', 850000, null, null, '{}'::jsonb)$$,
  'a confirmed value inside the saved AI range needs no deviation explanation'
);

select throws_ok(
  $$select public.record_inspection('63000000-0000-0000-0000-000000000003', true, 'fair', 950000, null, null, '{}'::jsonb)$$,
  '22023', 'an owner-visible explanation is required when confirmed value is outside the saved AI range',
  'a confirmed value outside the saved AI range is blocked without an explanation'
);

select lives_ok(
  $$select public.record_inspection('63000000-0000-0000-0000-000000000003', true, 'fair', 950000, 'Extension and condition evidence support the higher value.', null, '{}'::jsonb)$$,
  'an out-of-range confirmed value is accepted with an owner-visible explanation'
);

select is(
  (select reason from public.application_events where application_id = '63000000-0000-0000-0000-000000000003' and action = 'record_inspection' order by id desc limit 1),
  'Extension and condition evidence support the higher value.',
  'the out-of-range explanation is recorded in the owner-visible event reason'
);

create temporary table plan_b_issue_preview as
select public.preview_application_offer('63000000-0000-0000-0000-000000000001', 'issue', null) as payload;

select is((select payload->>'schema_version' from plan_b_issue_preview), '1', 'preview contract is versioned');
select is((select (payload->>'offer_amount')::numeric from plan_b_issue_preview), 600000::numeric, 'Plan B preview uses confirmed value times 75 percent');
select is((select payload->>'offer_kind' from plan_b_issue_preview), 'formal_guarantee_floor', 'Plan B preview labels the formal floor');
select is((select (payload->>'can_finalize')::boolean from plan_b_issue_preview), true, 'eligible preview can be finalized');
select is((select status from public.applications where id = '63000000-0000-0000-0000-000000000001'), 'inspected', 'preview does not change application status');
select is((select count(*) from public.application_events where application_id = '63000000-0000-0000-0000-000000000001'), 0::bigint, 'preview writes no event');

select lives_ok(
  $$select public.issue_offer_from_preview(
    '63000000-0000-0000-0000-000000000001',
    (select payload->>'case_revision' from plan_b_issue_preview),
    (select (payload->>'offer_amount')::numeric from plan_b_issue_preview),
    null, '{}'::jsonb
  )$$,
  'an admin can explicitly issue the exact reviewed offer'
);

select results_eq(
  $$select status, offer_amount from public.applications where id = '63000000-0000-0000-0000-000000000001'$$,
  $$values ('offer_sent'::text, 600000::numeric)$$,
  'guarded issue persists the authoritative amount'
);
select is((select count(*) from public.application_events where application_id = '63000000-0000-0000-0000-000000000001' and action = 'issue_offer'), 1::bigint, 'guarded issue writes exactly one event');

create temporary table stale_preview as
select public.preview_application_offer('63000000-0000-0000-0000-000000000006', 'issue', null) as payload;
reset role;
update public.applications set confirmed_value = 810000.75 where id = '63000000-0000-0000-0000-000000000006';
set local role authenticated;
set local request.jwt.claim.sub = '61000000-0000-0000-0000-000000000099';

select throws_ok(
  $$select public.issue_offer_from_preview(
    '63000000-0000-0000-0000-000000000006',
    (select payload->>'case_revision' from stale_preview),
    (select (payload->>'offer_amount')::numeric from stale_preview),
    null, '{}'::jsonb
  )$$,
  '40001', 'formal offer preview is stale; reload and preview again',
  'a changed confirmed value is rejected before an unreviewed offer is issued'
);
select is((select status from public.applications where id = '63000000-0000-0000-0000-000000000006'), 'inspected', 'stale guarded issue leaves the case inspected');

reset role;
update public.applications
set offer_expires_at = null
where id = '63000000-0000-0000-0000-000000000004';
set local role authenticated;
set local request.jwt.claim.sub = '61000000-0000-0000-0000-000000000099';
select throws_ok(
  $$select public.preview_application_offer('63000000-0000-0000-0000-000000000004', 'keep_review', null)$$,
  '22023', 'formal offer deadline is missing or expired; reload the application',
  'review response preview fails closed when the formal deadline is missing'
);
reset role;
update public.applications
set offer_expires_at = now() + interval '14 days'
where id = '63000000-0000-0000-0000-000000000004';
set local role authenticated;
set local request.jwt.claim.sub = '61000000-0000-0000-0000-000000000099';

create temporary table keep_preview as
select public.preview_application_offer('63000000-0000-0000-0000-000000000004', 'keep_review', null) as payload;
select lives_ok(
  $$select public.respond_review_from_preview(
    '63000000-0000-0000-0000-000000000004', 'keep_review',
    (select payload->>'case_revision' from keep_preview),
    (select (payload->>'offer_amount')::numeric from keep_preview),
    'We rechecked the evidence and kept the confirmed value.', null, null, '{}'::jsonb
  )$$,
  'an admin can keep the reviewed confirmed value with an owner-visible explanation'
);

create temporary table revise_preview as
select public.preview_application_offer('63000000-0000-0000-0000-000000000005', 'revise_review', 810000) as payload;
select is((select (payload->>'offer_amount')::numeric from revise_preview), 607500::numeric, 'review revision preview uses the exact proposed confirmed value');
select lives_ok(
  $$select public.respond_review_from_preview(
    '63000000-0000-0000-0000-000000000005', 'revise_review',
    (select payload->>'case_revision' from revise_preview),
    (select (payload->>'offer_amount')::numeric from revise_preview),
    'The additional evidence supports the revised confirmed value.', 810000, null, '{}'::jsonb
  )$$,
  'an admin can revise and reissue the reviewed offer from the exact preview'
);
select results_eq(
  $$select status, confirmed_value, offer_amount from public.applications where id = '63000000-0000-0000-0000-000000000005'$$,
  $$values ('offer_sent'::text, 810000::numeric, 607500::numeric)$$,
  'review revision persists the exact basis and formula-derived floor'
);

select throws_ok(
  $$select public.send_indicative(
    '63000000-0000-0000-0000-000000000007', 669201, 860400, null,
    '{"initial_figures_receipt":{"version":1,"plan":"B","meaning":"expected_open_market_proceeds","source":"application.plan_quote_snapshot.plan_b","canonical_low":669200,"canonical_high":860400,"canonical_floor":600000}}'::jsonb
  )$$,
  '22023', 'Plan B initial figures and receipt must exactly match the saved quote',
  'Plan B cannot send browser-supplied figures that differ from the saved quote'
);

select throws_ok(
  $$select public.send_indicative(
    '63000000-0000-0000-0000-000000000007', 669200, 860400, null,
    '{"initial_figures_receipt":{"version":1,"plan":"B","meaning":"guarantee_floor","source":"application.plan_quote_snapshot.plan_b","canonical_low":669200,"canonical_high":860400,"canonical_floor":600000}}'::jsonb
  )$$,
  '22023', 'Plan B initial figures and receipt must exactly match the saved quote',
  'Plan B cannot persist a receipt with a different monetary meaning'
);

select lives_ok(
  $$select public.send_indicative(
    '63000000-0000-0000-0000-000000000007', 669200, 860400, null,
    '{"initial_figures_receipt":{"version":1,"plan":"B","meaning":"expected_open_market_proceeds","source":"application.plan_quote_snapshot.plan_b","canonical_low":669200,"canonical_high":860400,"canonical_floor":600000}}'::jsonb
  )$$,
  'the hardened indicative RPC accepts the exact saved Plan B figures and receipt'
);
reset role;
select is(
  (select payload #>> '{initial_figures_receipt,meaning}' from public.application_events where application_id = '63000000-0000-0000-0000-000000000007' and action = 'send_indicative'),
  'expected_open_market_proceeds',
  'the Plan B receipt persists in protected audit payload'
);

select * from finish();
rollback;
