-- Security tests. Each block runs as a user and checks what they can and can't do.
\set ON_ERROR_STOP on
\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''
\set C '''cccccccc-0000-0000-0000-000000000003'''

create or replace function pg_temp.expect_fail(q text, why text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then raise notice 'ok   (blocked) %', why; return; end;
  raise exception 'FAIL: expected to be blocked: %', why;
end $$;
create or replace function pg_temp.expect(cond boolean, why text) returns void language plpgsql as $$
begin if not cond then raise exception 'FAIL: %', why; end if; raise notice 'ok   %', why; end $$;

-- sign-ups (as the auth system)
insert into auth.users values (:A, null, '+27830000001', '{"first_name":"Matthew","last_name":"Mbuso"}');
insert into auth.users values (:B, 'owner@potluck.test', '+27830000002', '{"first_name":"Lee","role":"employer"}');
insert into auth.users values (:C, null, '+27830000003', '{"first_name":"Aisha"}');
select pg_temp.expect((select role from profiles where id = :A) = 'staff' and (select first_name from profiles where id = :A) = 'Matthew', 'sign-up creates a staff profile from metadata');
select pg_temp.expect((select role from profiles where id = :B) = 'employer', 'employer sign-up gets the employer role');

grant execute on function pg_temp.expect(boolean, text), pg_temp.expect_fail(text, text) to authenticated, anon;

-- Employer B creates a venue and a shift
set role authenticated; select set_config('request.jwt.claim.sub', :B, false);
select pg_temp.expect_fail($$insert into venues (owner_id, name, approved) values ('bbbbbbbb-0000-0000-0000-000000000002', 'Sneaky', true)$$, 'venue cannot approve itself');
insert into venues (id, owner_id, name, area, lat, lng) values ('11111111-0000-0000-0000-00000000000a', :B, 'Potluck Club', 'Woodstock', -33.927, 18.448);
insert into shifts (id, venue_id, role, starts_at, ends_at, pay_cents, area, lat, lng)
  values ('22222222-0000-0000-0000-00000000000b', '11111111-0000-0000-0000-00000000000a', 'Bartender', now() + interval '3 days', now() + interval '3 days 5 hours', 45000, 'Woodstock', -33.927, 18.448);
select pg_temp.expect_fail($$update venues set approved = true$$, 'owner cannot approve their own venue');
select pg_temp.expect_fail($$update profiles set role = 'staff' where id = auth.uid()$$, 'nobody can change their own role');
select pg_temp.expect((select count(*) from profiles where role = 'staff') = 0, 'unapproved employer cannot browse staff');

-- Staff A before approval
select set_config('request.jwt.claim.sub', :A, false);
select pg_temp.expect((select count(*) from shifts) = 0, 'staff cannot see shifts from unapproved venues');
select pg_temp.expect_fail($$insert into applications (shift_id, staff_id) values ('22222222-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001')$$, 'cannot apply to an unapproved venue');
select pg_temp.expect_fail($$update profiles set rtw_status = 'verified' where id = auth.uid()$$, 'staff cannot verify themselves');
update profiles set address = '15 Alfred Street, Observatory', lat = -33.938, lng = 18.471, travel_km = 10 where id = auth.uid();
insert into staff_private (id, nationality, id_number) values (:A, 'South African', '9804125800087');
select pg_temp.expect((select rtw_status from profiles where id = auth.uid()) = 'pending', 'submitting ID moves status to pending');

-- Account manager approves the venue (service role)
reset role; select set_config('request.jwt.claim.sub', '', false);
update venues set approved = true where id = '11111111-0000-0000-0000-00000000000a';

-- Staff A after approval
set role authenticated; select set_config('request.jwt.claim.sub', :A, false);
select pg_temp.expect((select count(*) from shifts) = 1, 'staff see open shifts from approved venues');
select pg_temp.expect((select count(*) from shifts_near(-33.938, 18.471, 10)) = 1, 'shift found within 10 km');
select pg_temp.expect((select count(*) from shifts_near(-33.938, 18.471, 1)) = 0, 'shift excluded beyond 1 km');
select pg_temp.expect_fail($$insert into applications (shift_id, staff_id, status) values ('22222222-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001', 'booked')$$, 'staff cannot book themselves');
select pg_temp.expect_fail($$insert into applications (shift_id, staff_id) values ('22222222-0000-0000-0000-00000000000b', 'cccccccc-0000-0000-0000-000000000003')$$, 'cannot apply for someone else');
insert into applications (shift_id, staff_id) values ('22222222-0000-0000-0000-00000000000b', :A);
select pg_temp.expect_fail($$update applications set status = 'booked' where staff_id = auth.uid()$$, 'staff cannot mark themselves booked');
select pg_temp.expect((select count(*) from profiles) = 1, 'staff only see their own profile');

-- Roles stay in their lane
select pg_temp.expect_fail($$insert into venues (owner_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'My venue')$$, 'staff accounts cannot create venues');
select pg_temp.expect_fail($$insert into venues (owner_id, name) values ('bbbbbbbb-0000-0000-0000-000000000002', 'Not mine')$$, 'nobody can create a venue for someone else');
select pg_temp.expect_fail($$insert into shifts (venue_id, role, starts_at, ends_at, pay_cents) values ('11111111-0000-0000-0000-00000000000a', 'Waiter', now() + interval '1 day', now() + interval '1 day 4 hours', 50000)$$, 'staff cannot post shifts at someone else''s venue');
update shifts set pay_cents = 1;
select pg_temp.expect((select pay_cents from shifts limit 1) = 45000, 'staff cannot change a shift (update has no effect)');

-- Staff C applies, venue B shortlists and books
select set_config('request.jwt.claim.sub', :C, false);
insert into applications (shift_id, staff_id) values ('22222222-0000-0000-0000-00000000000b', :C);
select pg_temp.expect((select count(*) from applications) = 1, 'staff only see their own applications');

select set_config('request.jwt.claim.sub', :B, false);
select pg_temp.expect((select count(*) from applications) = 2, 'venue sees applications to its shifts');
select pg_temp.expect((select count(*) from applications a join profiles p on p.id = a.staff_id) = 2, 'venue can see who applied (name and photo)');
update applications set status = 'booked' where staff_id = :C;
select pg_temp.expect((select status from applications where staff_id = :C) = 'booked', 'venue can book an applicant');
select pg_temp.expect_fail($$update applications set status = 'withdrawn' where staff_id = 'cccccccc-0000-0000-0000-000000000003'$$, 'venue cannot withdraw for staff');
select pg_temp.expect((select count(*) from profiles where role = 'staff') = 2, 'approved employer can browse staff');
select pg_temp.expect((select count(*) from staff_private) = 0, 'employer can never read ID numbers');
select set_config('request.jwt.claim.sub', :B, false);
select pg_temp.expect_fail($$insert into applications (shift_id, staff_id) values ('22222222-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002')$$, 'employers cannot apply for shifts');
update shifts set status = 'filled' where id = '22222222-0000-0000-0000-00000000000b';
select pg_temp.expect((select status from shifts where id = '22222222-0000-0000-0000-00000000000b') = 'filled', 'venue can mark its shift filled');
select set_config('request.jwt.claim.sub', :C, false);
select pg_temp.expect((select count(*) from shifts) = 0, 'filled shifts disappear from the staff list');
select set_config('request.jwt.claim.sub', :B, false);
select pg_temp.expect((select count(*) from applications) = 2, 'venue still sees applicants on a filled shift');
update shifts set status = 'open' where id = '22222222-0000-0000-0000-00000000000b';

select set_config('request.jwt.claim.sub', :A, false);
update applications set status = 'withdrawn' where staff_id = auth.uid();
select pg_temp.expect((select status from applications where staff_id = auth.uid()) = 'withdrawn', 'staff can withdraw');

-- Anonymous visitors see nothing
reset role; set role anon;
select pg_temp.expect((select count(*) from shifts) = 0 and (select count(*) from profiles) = 0, 'anonymous visitors see no shifts or profiles');
reset role;
\echo 'ALL DATABASE TESTS PASSED'
