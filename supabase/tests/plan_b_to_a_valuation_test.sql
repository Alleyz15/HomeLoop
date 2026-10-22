begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('71000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'btoa-owner-1@example.test', 'not-a-real-password', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('71000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'btoa-owner-2@example.test', 'not-a-real-password', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('71000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'btoa-owner-3@example.test', 'not-a-real-password', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('71000000-0000-0000-0000-000000000099', 'authenticated', 'authenticated', 'btoa-admin@example.test', 'not-a-real-password', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update public.profiles set role = 'admin'
where id = '71000000-0000-0000-0000-000000000099';

insert into public.sdp_launches (id, tier, project, township, price_from_rm, checked_on)
values (95001, 'selling', 'B to A Test Launch', 'Test Township', 900000, current_date);

insert into public.valuation_requests (
  id, user_id, scheme, ptype, land_sqm, floor_sqm, tenure,
  estimate, low, high, confidence, valuation_status
)
values
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'B TO A TEST', 'Terraced', 164, 180, 'Freehold', 800000, 700000, 900000, 'high', 'ok'),
  ('72000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000002', 'B TO A TEST', 'Terraced', 164, 180, 'Freehold', 800000, 700000, 900000, 'high', 'ok'),
  ('72000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000003', 'B TO A TEST', 'Terraced', 164, 180, 'Freehold', 800000, 700000, 900000, 'high', 'ok');

insert into public.applications (
  id, user_id, valuation_id, launch_id, unit_type, plan,
  new_home_price, new_home_price_source, address_line, postcode,
  pdpa_consent, status, inspection_scheduled_at, confirmed_value,
  offer_amount, offer_sent_at, offer_expires_at, review_count,
  valuation_snapshot, plan_quote_snapshot, plan_switch_count
)
values
  ('73000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 95001, 'Type A', 'B', 900000, 'sales_quote', '1 Test Road', '40150', true, 'offer_sent', now(), 800000, 600000, now(), now() + interval '14 days', 0, '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"high","is_sdp":true}', '{}', 0),
  ('73000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000002', 95001, 'Type A', 'B', 900000, 'sales_quote', '2 Test Road', '40150', true, 'offer_sent', now(), 800000, 600000, now(), now() + interval '14 days', 0, '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"high","is_sdp":true}', '{}', 0),
  ('73000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000003', 95001, 'Type A', 'A', 900000, 'sales_quote', '3 Test Road', '40150', true, 'inspection_scheduled', null, 800000, null, null, null, 0, '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"high","is_sdp":true}', '{}', 0);

set local role authenticated;
set local request.jwt.claim.sub = '71000000-0000-0000-0000-000000000001';

select lives_ok(
  $$select public.switch_plan('73000000-0000-0000-0000-000000000001', null, '{}'::jsonb)$$,
  'owner can use the existing one-time Plan B to Plan A switch'
);
select results_eq(
  $$select plan, status, plan_switch_count, inspection_scheduled_at, confirmed_value from public.applications where id = '73000000-0000-0000-0000-000000000001'$$,
  $$values ('A'::text, 'inspection_scheduled'::text, 1, null::timestamptz, 800000::numeric)$$,
  'switch keeps the prior Plan B value but clears the appointment'
);
select throws_ok(
  $$select public.schedule_plan_a_valuation('73000000-0000-0000-0000-000000000001', now() + interval '1 day', null, '{}'::jsonb)$$,
  '42501', 'admin access required', 'owner cannot schedule the registered valuation'
);

set local request.jwt.claim.sub = '71000000-0000-0000-0000-000000000099';

select ok(
  pg_catalog.has_function_privilege('authenticated', 'public.schedule_plan_a_valuation(uuid,timestamptz,text,jsonb)', 'EXECUTE')
  and not pg_catalog.has_function_privilege('anon', 'public.schedule_plan_a_valuation(uuid,timestamptz,text,jsonb)', 'EXECUTE'),
  'only authenticated callers can reach the guarded RPC'
);
select throws_ok(
  $$select public.schedule_plan_a_valuation('73000000-0000-0000-0000-000000000003', now() + interval '1 day', null, '{}'::jsonb)$$,
  '22023', 'registered valuation scheduling requires a recorded Plan B to Plan A switch',
  'an ordinary Plan A inspection_scheduled row cannot use the follow-up RPC'
);
select lives_ok(
  $$select public.schedule_plan_a_valuation('73000000-0000-0000-0000-000000000001', now() + interval '1 day', 'Appointment confirmed externally.', '{}'::jsonb)$$,
  'admin can schedule the registered valuation after the switch'
);
select is(
  (select status from public.applications where id = '73000000-0000-0000-0000-000000000001'),
  'inspection_scheduled', 'scheduling keeps the case at inspection_scheduled'
);
select isnt(
  (select inspection_scheduled_at from public.applications where id = '73000000-0000-0000-0000-000000000001'),
  null::timestamptz, 'scheduling records the appointment'
);
select is(
  (select count(*) from public.application_events where application_id = '73000000-0000-0000-0000-000000000001' and action = 'schedule_plan_a_valuation'),
  1::bigint, 'scheduling writes exactly one event'
);
select throws_ok(
  $$select public.schedule_plan_a_valuation('73000000-0000-0000-0000-000000000001', now() + interval '2 days', null, '{}'::jsonb)$$,
  '22023', 'registered valuation appointment is already recorded',
  'the appointment cannot be silently overwritten'
);
select throws_ok(
  $$select public.record_inspection('73000000-0000-0000-0000-000000000001', true, 'good', 820000, null, 'Registered valuer: Test Valuer; Valuation basis: site inspection', '{}'::jsonb)$$,
  '22023', 'an owner-visible explanation is required when the registered value differs from the previous Plan B confirmed value',
  'a changed registered value is blocked without an owner-visible explanation'
);
select throws_ok(
  $$select public.record_inspection('73000000-0000-0000-0000-000000000001', true, 'good', 800000, null, null, '{}'::jsonb)$$,
  '22023', 'Plan B to Plan A valuation basis and registered valuer must be named in the note',
  'the external registered-valuer evidence is mandatory even when the value is unchanged'
);
select lives_ok(
  $$select public.record_inspection('73000000-0000-0000-0000-000000000001', true, 'good', 820000, 'The registered valuer included the verified extension after the owner switched plans.', 'Registered valuer: Test Valuer; Valuation basis: site inspection and title review', '{}'::jsonb)$$,
  'admin can record the new value with valuer evidence and an owner-visible explanation'
);
select results_eq(
  $$select status, confirmed_value, value_adjust_reason from public.applications where id = '73000000-0000-0000-0000-000000000001'$$,
  $$values ('inspected'::text, 820000::numeric, 'The registered valuer included the verified extension after the owner switched plans.'::text)$$,
  'the registered value and public explanation are stored'
);
select results_eq(
  $$select (payload->>'previous_confirmed_value')::numeric, (payload->>'confirmed_value')::numeric, reason from public.get_application_audit('73000000-0000-0000-0000-000000000001') where action = 'record_inspection'$$,
  $$values (800000::numeric, 820000::numeric, 'The registered valuer included the verified extension after the owner switched plans.'::text)$$,
  'the event preserves both values and the owner-visible explanation'
);
select is(
  (select count(*) from public.application_events where application_id = '73000000-0000-0000-0000-000000000001' and action = 'record_inspection'),
  1::bigint, 'recording the new valuation writes exactly one event'
);
select is(
  (public.preview_application_offer('73000000-0000-0000-0000-000000000001', 'issue', null)->>'offer_amount')::numeric,
  643700::numeric, 'the existing backend formula computes the Plan A offer from the new confirmed value'
);

set local request.jwt.claim.sub = '71000000-0000-0000-0000-000000000002';
select lives_ok(
  $$select public.switch_plan('73000000-0000-0000-0000-000000000002', null, '{}'::jsonb)$$,
  'second owner switches a second case for the unchanged-value path'
);
set local request.jwt.claim.sub = '71000000-0000-0000-0000-000000000099';
select lives_ok(
  $$select public.schedule_plan_a_valuation('73000000-0000-0000-0000-000000000002', now() + interval '1 day', null, '{}'::jsonb)$$,
  'second registered valuation is scheduled'
);
select lives_ok(
  $$select public.record_inspection('73000000-0000-0000-0000-000000000002', true, 'fair', 800000, null, 'Registered valuer: Test Valuer; Valuation basis: site inspection', '{}'::jsonb)$$,
  'an unchanged in-range value needs valuer evidence but no difference explanation'
);

select * from finish();
rollback;
