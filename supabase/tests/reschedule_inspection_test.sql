begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('81000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'reschedule-owner@example.test', 'not-a-real-password', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('81000000-0000-0000-0000-000000000099', 'authenticated', 'authenticated', 'reschedule-admin@example.test', 'not-a-real-password', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update public.profiles set role = 'admin'
where id = '81000000-0000-0000-0000-000000000099';

insert into public.sdp_launches (id, tier, project, township, price_from_rm, checked_on)
values (96001, 'selling', 'Reschedule Test Launch', 'Test Township', 900000, current_date);

insert into public.valuation_requests (
  id, user_id, scheme, ptype, land_sqm, floor_sqm, tenure,
  estimate, low, high, confidence, valuation_status
)
values (
  '82000000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000001',
  'RESCHEDULE TEST', 'Terraced', 164, 180, 'Freehold',
  800000, 700000, 900000, 'high', 'ok'
);

insert into public.applications (
  id, user_id, valuation_id, launch_id, unit_type, plan,
  new_home_price, new_home_price_source, address_line, postcode,
  pdpa_consent, status, inspection_scheduled_at,
  valuation_snapshot, plan_quote_snapshot
)
values (
  '83000000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000001',
  '82000000-0000-0000-0000-000000000001',
  96001, 'Type A', 'B', 900000, 'sales_quote', '1 Test Road', '40150',
  true, 'inspection_scheduled', now() + interval '1 day',
  '{"status":"ok","estimate":800000,"low":700000,"high":900000,"confidence":"high","is_sdp":true}', '{}'
);

select ok(
  pg_catalog.has_function_privilege('authenticated', 'public.reschedule_inspection(uuid,timestamptz,text,jsonb)', 'EXECUTE')
  and not pg_catalog.has_function_privilege('anon', 'public.reschedule_inspection(uuid,timestamptz,text,jsonb)', 'EXECUTE'),
  'only authenticated callers can reach the guarded reschedule RPC'
);

set local role authenticated;
set local request.jwt.claim.sub = '81000000-0000-0000-0000-000000000001';

select throws_ok(
  $$select public.reschedule_inspection('83000000-0000-0000-0000-000000000001', now() + interval '2 days', null, '{}'::jsonb)$$,
  '42501', 'admin access required', 'an owner cannot reschedule an inspection'
);

set local request.jwt.claim.sub = '81000000-0000-0000-0000-000000000099';

select throws_ok(
  $$select public.reschedule_inspection('83000000-0000-0000-0000-000000000001', now() - interval '1 minute', null, '{}'::jsonb)$$,
  '22023', 'new inspection schedule must be in the future',
  'a past appointment is rejected'
);

select public.reschedule_inspection(
  '83000000-0000-0000-0000-000000000001',
  now() + interval '2 days',
  'Owner requested a later visit.',
  '{"source":"admin_ui"}'::jsonb
);

reset role;

select is(
  (select status from public.applications where id = '83000000-0000-0000-0000-000000000001'),
  'inspection_scheduled', 'rescheduling keeps the workflow stage unchanged'
);
select is(
  (select count(*) from public.application_events
   where application_id = '83000000-0000-0000-0000-000000000001'
     and action = 'reschedule_inspection'),
  1::bigint, 'rescheduling writes exactly one event'
);
select results_eq(
  $$select from_status, to_status, note is not null,
           payload ? 'previous_scheduled_at', payload ? 'scheduled_at'
    from public.application_events
    where application_id = '83000000-0000-0000-0000-000000000001'
      and action = 'reschedule_inspection'$$,
  $$values ('inspection_scheduled'::text, 'inspection_scheduled'::text, true, true, true)$$,
  'the audit event records the same-stage transition and both appointment times'
);

select * from finish();
rollback;
