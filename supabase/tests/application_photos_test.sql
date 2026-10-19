-- Local pgTAP fixtures only. Every row and metadata fixture rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('71000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  'authenticated','authenticated','photo-local-' || n || '@example.test','not-a-password',
  now(),'{}','{}',now(),now() from generate_series(1,4) n;
update public.profiles set role='admin' where id='71000000-0000-4000-8000-000000000004';
insert into public.sdp_launches(id,tier,project,township,price_from_rm,checked_on)
values (97101,'selling','Local photo test launch','Local test',900000,current_date);
insert into public.valuation_requests(id,user_id,scheme,ptype,valuation_status)
select ('72000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  ('71000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'TEST','Terrace','ok'
  from generate_series(1,3) n;
insert into public.applications(id,user_id,valuation_id,launch_id,unit_type,plan,
  new_home_price,new_home_price_source,address_line,postcode,pdpa_consent,status,
  info_return_status,offer_amount,offer_sent_at,offer_expires_at)
select ('73000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  ('71000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  ('72000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  97101,'Standard home type','B',900000,'price_from','12, TEST','40150',true,
  case when n=3 then 'offer_sent' else 'info_requested' end,
  case when n=3 then null else 'under_review' end,
  case when n=3 then 600000 else null end,
  case when n=3 then now() else null end,
  case when n=3 then now()+interval '14 days' else null end
  from generate_series(1,3) n;
insert into public.application_events(id,application_id,actor_id,actor_role,from_status,to_status,
  action,reason,note,payload)
select 97100+n,('73000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  '71000000-0000-4000-8000-000000000004','admin','under_review',
  case when n=3 then 'offer_sent' else 'info_requested' end,
  case when n=3 then 'issue_offer' else 'request_info' end,
  'Please clarify the rear extension','INTERNAL: never show this to the owner',
  '{"private_check":"not customer-facing"}' from generate_series(1,3) n;

select is((select public from storage.buckets where id='application-photos'),false,'new bucket is private');
select is((select file_size_limit from storage.buckets where id='application-photos'),5242880::bigint,'5 MiB limit');
select is((select cardinality(allowed_mime_types) from storage.buckets where id='application-photos'),3,'three allowed image MIME types');
select ok(not has_table_privilege('authenticated','public.application_photos','insert'),'no direct photo-row inserts');
select ok(not has_column_privilege('authenticated','public.application_events','note','select'),'raw audit notes are not API-readable');
select ok(not has_column_privilege('authenticated','public.application_events','payload','select'),'raw audit payloads are not API-readable');
select ok(has_column_privilege('authenticated','public.application_events','owner_message','select'),'explicit owner messages are readable');
select ok(not has_function_privilege('anon','public.reserve_application_photo(uuid,text,bigint,text,text,bigint)','execute'),'anonymous reservation forbidden');

set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
select throws_ok($$select note from public.application_events$$,'42501',null,'owner cannot read admin notes directly');
select throws_ok($$select payload from public.application_events$$,'42501',null,'owner cannot read private payload directly');
select is((select count(*) from public.application_events),1::bigint,'owner only sees own case events');
select throws_ok($$select * from public.get_application_audit('73000000-0000-4000-8000-000000000001')$$,
  '42501','admin access required','owner cannot bypass privacy with admin audit RPC');
select throws_ok($$select public.send_owner_message('73000000-0000-4000-8000-000000000001','forged admin message')$$,
  '42501','admin access required','owner cannot impersonate team messages');
select throws_ok($$select public.reserve_application_photo('73000000-0000-4000-8000-000000000002','info_response',97102,'a.jpg','image/jpeg',100)$$,
  '42501','application owner access required','cannot upload into another owner case');
select throws_ok($$select public.reserve_application_photo('73000000-0000-4000-8000-000000000001','info_response',99999,'a.jpg','image/jpeg',100)$$,
  '22023','request or offer changed; reload before uploading','stale request context rejected');
select throws_ok($$select public.reserve_application_photo('73000000-0000-4000-8000-000000000001','offer_review',97101,'a.jpg','image/jpeg',100)$$,
  '22023','this action is not available at the current application stage','wrong purpose rejected');
select throws_ok($$select public.reserve_application_photo('73000000-0000-4000-8000-000000000001','info_response',97101,'x.pdf','application/pdf',100)$$,
  '22023','only JPEG, PNG and WebP photos are allowed','PDF is not silently enabled');
select throws_ok($$select public.reserve_application_photo('73000000-0000-4000-8000-000000000001','info_response',97101,'a.jpg','image/jpeg',5242881)$$,
  '22023','invalid photo name or size; maximum 5 MB','oversized photo rejected');
select throws_ok($$select public.reserve_application_photo('73000000-0000-4000-8000-000000000001','info_response',97101,'../a.jpg','image/jpeg',100)$$,
  '22023','invalid photo name or size; maximum 5 MB','path traversal in display filename rejected');

do $$begin
  perform set_config('test.photo_id',(public.reserve_application_photo(
    '73000000-0000-4000-8000-000000000001','info_response',97101,'rear.jpg','image/jpeg',100)).id::text,true);
end$$;
select is((select count(*) from public.application_photos),1::bigint,'owned pending photo is visible');
select throws_ok($$select public.submit_application_response('73000000-0000-4000-8000-000000000001',
  'info_response',97101,'Here is the rear view',array[current_setting('test.photo_id')::uuid])$$,
  '22023','photo upload is missing or its metadata does not match','cannot attach nonexistent storage object');
select is((select status from public.applications where id='73000000-0000-4000-8000-000000000001'),
  'info_requested','failed upload does not advance the case');
select is((select count(*) from public.application_events),1::bigint,'failed reply writes no event');

-- Storage metadata fixtures are only for SQL validation. Actual file API tests are separate.
reset role;
insert into storage.objects(bucket_id,name,owner_id,metadata)
select 'application-photos',object_path,user_id::text,'{"size":100,"mimetype":"image/jpeg"}'
  from public.application_photos where id=current_setting('test.photo_id')::uuid;
set local role authenticated;
select throws_ok($$select public.submit_application_response('73000000-0000-4000-8000-000000000001',
  'info_response',97101,' ',array[]::uuid[])$$,
  '22023','a reply or review reason of 1–4000 characters is required','empty reply rejected');
select throws_ok($$select public.submit_application_response('73000000-0000-4000-8000-000000000001',
  'info_response',97101,'Reply',array[current_setting('test.photo_id')::uuid,current_setting('test.photo_id')::uuid])$$,
  '22023','choose at most five different photos','duplicate photo ids rejected');
select lives_ok($$select public.submit_application_response('73000000-0000-4000-8000-000000000001',
  'info_response',97101,'Here is the rear view',array[current_setting('test.photo_id')::uuid])$$,
  'valid reply and photo submitted atomically');
select is((select status from public.applications where id='73000000-0000-4000-8000-000000000001'),
  'under_review','reply returns to original review gate');
select is((select owner_message from public.application_events where action='provide_info'),
  'Here is the rear view','owner reply text retained separately from private audit');
select is((select count(*) from public.application_events where action='provide_info'),1::bigint,'reply still writes exactly one event');
select is((select state from public.application_photos where id=current_setting('test.photo_id')::uuid),
  'attached','photo linked to the action event');
select throws_ok($$select public.cancel_application_photo(current_setting('test.photo_id')::uuid)$$,
  '22023','submitted photos cannot be removed or replaced','submitted evidence immutable');
select throws_ok($$select public.submit_application_response('73000000-0000-4000-8000-000000000001',
  'info_response',97101,'Duplicate reply',array[]::uuid[])$$,
  '22023','this action is not available at the current application stage','double-click cannot submit again');

select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.application_photos),0::bigint,'other owner cannot read photo records');
select is((select count(*) from storage.objects where bucket_id='application-photos'),0::bigint,'other owner cannot read storage objects');
select throws_ok($$select public.cancel_application_photo(current_setting('test.photo_id')::uuid)$$,
  '42501','photo owner access required','other owner cannot cancel photo');

select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000003',true);
do $$begin
  for i in 1..5 loop perform public.reserve_application_photo(
    '73000000-0000-4000-8000-000000000003','offer_review',97103,'review.png','image/png',80); end loop;
end$$;
select throws_ok($$select public.reserve_application_photo('73000000-0000-4000-8000-000000000003',
  'offer_review',97103,'sixth.png','image/png',80)$$,'22023',
  'maximum five pending photos per reply or review','five-photo cap enforced in database');
do $$begin
  perform set_config('test.cancel_id',(select id::text from public.application_photos where user_id=auth.uid() limit 1),true);
end$$;
select lives_ok($$select public.cancel_application_photo(current_setting('test.cancel_id')::uuid)$$,'pending photo can be removed before submission');
select lives_ok($$select public.reserve_application_photo('73000000-0000-4000-8000-000000000003',
  'offer_review',97103,'replacement.webp','image/webp',100)$$,'cancelled slot can be replaced with a fresh reservation');
select throws_ok($$select public.submit_application_response('73000000-0000-4000-8000-000000000003',
  'offer_review',97103,'Please review the value',array[current_setting('test.photo_id')::uuid])$$,
  '22023','photo does not belong to this pending response','foreign photo cannot be reused in another review');
select lives_ok($$select public.submit_application_response('73000000-0000-4000-8000-000000000003',
  'offer_review',97103,'Please review the value',array[]::uuid[])$$,'review may be submitted without optional photos');
select is((select review_count from public.applications where id='73000000-0000-4000-8000-000000000003'),1,'existing single-review rule retained');
select is((select count(*) from public.application_events where action='request_review'),1::bigint,'review writes one event');

select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000004',true);
select is((select count(*) from public.application_photos),1::bigint,'admin sees submitted photo only, not unsent reservations');
select lives_ok($$select public.send_owner_message('73000000-0000-4000-8000-000000000001',
  'Thank you, we received your photo.','INTERNAL follow-up')$$,'admin explicitly publishes an owner message');
select is((select count(*) from public.get_application_audit('73000000-0000-4000-8000-000000000001')
  where note like 'INTERNAL%'),2::bigint,'admin audit RPC retains old and new private notes');
select throws_ok($$select note from public.application_events$$,'42501',null,'even admin must use protected audit RPC for private columns');

select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
select is((select owner_message from public.application_events where action='owner_message'),
  'Thank you, we received your photo.','owner sees only deliberately published message');
select is((select status from public.applications where id='73000000-0000-4000-8000-000000000001'),
  'under_review','publishing message does not change workflow state');

-- A repeated request must not accept a stale browser tab from the earlier request.
reset role;
update public.applications set status='info_requested',info_return_status='inspected'
  where id='73000000-0000-4000-8000-000000000001';
insert into public.application_events(id,application_id,actor_id,actor_role,from_status,to_status,action,reason)
values (97104,'73000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000004','admin','inspected','info_requested','request_info','Please clarify again');
set local role authenticated;
select throws_ok($$select public.reserve_application_photo('73000000-0000-4000-8000-000000000001',
  'info_response',97101,'stale.jpg','image/jpeg',100)$$,'22023',
  'request or offer changed; reload before uploading','previous real request context cannot reserve new photos');
select throws_ok($$select public.submit_application_response('73000000-0000-4000-8000-000000000001',
  'info_response',97101,'Stale reply',array[]::uuid[])$$,'22023',
  'request or offer changed; reload before sending','previous real request context cannot advance a repeated request');
select lives_ok($$select public.submit_application_response('73000000-0000-4000-8000-000000000001',
  'info_response',97104,'Clarified',array[]::uuid[])$$,'latest request accepts a text-only response');
select is((select status from public.applications where id='73000000-0000-4000-8000-000000000001'),
  'inspected','post-inspection request returns to inspected rather than restarting review');

select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000002',true);
do $$begin
  perform set_config('test.expired_id',(public.reserve_application_photo(
    '73000000-0000-4000-8000-000000000002','info_response',97102,'expired.png','image/png',80)).id::text,true);
end$$;
reset role;
update public.application_photos set expires_at=now()-interval '1 second'
  where id=current_setting('test.expired_id')::uuid;
set local role authenticated;
select ok(not private.application_photo_access((select object_path from public.application_photos
  where id=current_setting('test.expired_id')::uuid),'upload'),'expired reservation cannot upload through Storage policy');
select throws_ok($$select public.submit_application_response('73000000-0000-4000-8000-000000000002',
  'info_response',97102,'Late upload',array[current_setting('test.expired_id')::uuid])$$,'22023',
  'photo does not belong to this pending response','expired reservation cannot be submitted');
select lives_ok($$select public.cancel_application_photo(current_setting('test.expired_id')::uuid)$$,
  'expired unsubmitted photo may still be cancelled for cleanup');
select throws_ok($$select public.submit_application_response('73000000-0000-4000-8000-000000000002',
  'info_response',97102,'Too many',array[
    '74000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000002',
    '74000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000004',
    '74000000-0000-4000-8000-000000000005','74000000-0000-4000-8000-000000000006']::uuid[])$$,
  '22023','choose at most five different photos','six distinct photo IDs are refused at final submission');

reset role;
update public.applications set status='offer_sent',review_count=0,offer_expires_at=now()-interval '1 second'
  where id='73000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.reserve_application_photo('73000000-0000-4000-8000-000000000003',
  'offer_review',97103,'expired-offer.jpg','image/jpeg',100)$$,'22023',
  'this action is not available at the current application stage','expired offer cannot reserve review photos');
reset role;
select * from finish();
rollback;
