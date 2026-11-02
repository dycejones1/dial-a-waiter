-- Team (admin) access: approve venues, check staff IDs, and keep a log of every decision.
-- Make someone an admin (run in the Supabase SQL editor, as the project owner):
--   update public.profiles set role = 'admin' where phone = '+27...';

-- A short note the team leaves when an ID isn't accepted, shown to the person so they know what to fix.
alter table public.profiles add column if not exists rtw_note text check (char_length(rtw_note) <= 300);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- Every admin decision is recorded: who, what, when, and why.
create table public.admin_actions (
  id          bigint generated always as identity primary key,
  admin_id    uuid not null references public.profiles (id),
  action      text not null check (action in ('venue_approved', 'venue_unapproved', 'rtw_verified', 'rtw_rejected', 'rtw_pending')),
  target_id   uuid not null,
  note        text check (char_length(note) <= 300),
  created_at  timestamptz not null default now()
);
alter table public.admin_actions enable row level security;
create policy "admin_actions: admins read" on public.admin_actions for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.admin_actions from authenticated, anon;

-- Admins can read what they need to check. Nobody else gains anything.
create policy "profiles: admins read all"      on public.profiles      for select to authenticated using (public.is_admin());
create policy "staff_private: admins read"     on public.staff_private for select to authenticated using (public.is_admin());
create policy "venues: admins read all"        on public.venues        for select to authenticated using (public.is_admin());
create policy "shifts: admins read all"        on public.shifts        for select to authenticated using (public.is_admin());
create policy "applications: admins read all"  on public.applications  for select to authenticated using (public.is_admin());
create policy "storage: admins read files"     on storage.objects      for select to authenticated
  using (bucket_id in ('photos', 'documents') and public.is_admin());

-- Approve (or un-approve) a venue.
create or replace function public.admin_set_venue_approval(p_venue uuid, p_approved boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only the Dial A Waiter team can do this'; end if;
  update public.venues set approved = p_approved where id = p_venue;
  if not found then raise exception 'Venue not found'; end if;
  insert into public.admin_actions (admin_id, action, target_id, note)
  values (auth.uid(), case when p_approved then 'venue_approved' else 'venue_unapproved' end, p_venue, left(p_note, 300));
end $$;

-- Record the result of an ID / work permit check.
create or replace function public.admin_set_rtw(p_profile uuid, p_status public.rtw_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only the Dial A Waiter team can do this'; end if;
  if p_status = 'not_submitted' then raise exception 'Choose verified, rejected or pending'; end if;
  if p_status = 'rejected' and coalesce(trim(p_note), '') = '' then raise exception 'Add a note so the person knows what to fix'; end if;
  update public.profiles
     set rtw_status = p_status, rtw_note = case when p_status = 'rejected' then left(p_note, 300) else null end
   where id = p_profile and role = 'staff';
  if not found then raise exception 'Staff member not found'; end if;
  insert into public.admin_actions (admin_id, action, target_id, note)
  values (auth.uid(), 'rtw_' || p_status::text, p_profile, left(p_note, 300));
end $$;

revoke execute on function public.admin_set_venue_approval(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_set_rtw(uuid, public.rtw_status, text) from public, anon;
grant execute on function public.admin_set_venue_approval(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_rtw(uuid, public.rtw_status, text) to authenticated;

-- Resubmitting documents clears the old note.
create or replace function public.mark_rtw_pending() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.id_number is not null or new.id_doc_path is not null then
    update public.profiles set rtw_status = 'pending', rtw_note = null
    where id = new.id and rtw_status in ('not_submitted', 'rejected');
  end if;
  return new;
end $$;
