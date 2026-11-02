-- Dial A Waiter: initial schema
-- Staff (job seekers) and employers share auth.users; their public details live in public.profiles.
-- Sensitive staff data (ID number, documents) lives in public.staff_private, readable only by its owner.
-- Every table has row level security. Approval fields can only be changed with the service role (admin).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('staff', 'employer');
create type public.rtw_status as enum ('not_submitted', 'pending', 'verified', 'rejected');
create type public.venue_kind as enum ('business', 'private');
create type public.shift_status as enum ('open', 'filled', 'cancelled');
create type public.application_status as enum ('applied', 'shortlisted', 'booked', 'declined', 'withdrawn');

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          public.user_role not null default 'staff',
  first_name    text not null default '' check (char_length(first_name) <= 80),
  last_name     text check (char_length(last_name) <= 80),
  gender        text check (char_length(gender) <= 40),
  date_of_birth date,
  email         text check (char_length(email) <= 254),
  phone         text check (char_length(phone) <= 20),
  confirmed_by  text check (confirmed_by in ('sms', 'email')),
  photo_path    text,
  address       text check (char_length(address) <= 300),
  lat           double precision check (lat between -90 and 90),
  lng           double precision check (lng between -180 and 180),
  travel_km     integer not null default 10 check (travel_km between 1 and 100),
  positions     text[] not null default '{}',
  cv_path       text,
  rtw_status    public.rtw_status not null default 'not_submitted',
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.staff_private (
  id            uuid primary key references public.profiles (id) on delete cascade,
  nationality   text check (char_length(nationality) <= 60),
  id_number     text check (char_length(id_number) <= 30),
  id_doc_path   text,
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Venues (employers) and shifts
-- ---------------------------------------------------------------------------
create table public.venues (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  kind        public.venue_kind not null default 'business',
  name        text not null check (char_length(name) between 1 and 120),
  area        text check (char_length(area) <= 120),
  lat         double precision check (lat between -90 and 90),
  lng         double precision check (lng between -180 and 180),
  approved    boolean not null default false,       -- set by an account manager (service role)
  created_at  timestamptz not null default now()
);
create index venues_owner_idx on public.venues (owner_id);

create table public.shifts (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues (id) on delete cascade,
  role         text not null check (char_length(role) between 1 and 60),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  pay_cents    integer not null check (pay_cents > 0),
  area         text check (char_length(area) <= 120),
  lat          double precision check (lat between -90 and 90),
  lng          double precision check (lng between -180 and 180),
  description  text check (char_length(description) <= 2000),
  bring        text[] not null default '{}',
  status       public.shift_status not null default 'open',
  created_at   timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index shifts_open_idx on public.shifts (status, starts_at);
create index shifts_venue_idx on public.shifts (venue_id);

create table public.applications (
  id          uuid primary key default gen_random_uuid(),
  shift_id    uuid not null references public.shifts (id) on delete cascade,
  staff_id    uuid not null references public.profiles (id) on delete cascade,
  status      public.application_status not null default 'applied',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (shift_id, staff_id)
);
create index applications_staff_idx on public.applications (staff_id);

create table public.availability (
  staff_id  uuid not null references public.profiles (id) on delete cascade,
  day       date not null,
  primary key (staff_id, day)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger staff_private_touch before update on public.staff_private for each row execute function public.touch_updated_at();
create trigger applications_touch before update on public.applications for each row execute function public.touch_updated_at();

-- Create a profile row when someone signs up. Sign-up metadata comes from the app.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, role, first_name, last_name, email, phone)
  values (
    new.id,
    case when meta->>'role' = 'employer' then 'employer'::public.user_role else 'staff'::public.user_role end,
    left(coalesce(meta->>'first_name', ''), 80),
    left(meta->>'last_name', 80),
    new.email,
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Is the signed-in user the owner of an approved venue?
create or replace function public.is_approved_employer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.venues v where v.owner_id = auth.uid() and v.approved)
$$;

-- Does the signed-in user own the venue behind this shift?
create or replace function public.owns_shift(p_shift uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.shifts s join public.venues v on v.id = s.venue_id
    where s.id = p_shift and v.owner_id = auth.uid()
  )
$$;

-- Great-circle distance in kilometres.
create or replace function public.distance_km(lat1 float8, lng1 float8, lat2 float8, lng2 float8) returns float8
language sql immutable as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

-- Open shifts from approved venues, nearest first. Runs with the caller's permissions (RLS applies).
create or replace function public.shifts_near(p_lat float8, p_lng float8, p_km float8)
returns table (
  shift_id uuid, venue_id uuid, venue_name text, shift_role text, starts_at timestamptz, ends_at timestamptz,
  pay_cents integer, area text, description text, km float8
)
language sql stable security invoker set search_path = public as $$
  select s.id, s.venue_id, v.name, s.role, s.starts_at, s.ends_at, s.pay_cents, s.area, s.description,
         case when p_lat is null or s.lat is null then null else public.distance_km(p_lat, p_lng, s.lat, s.lng) end
  from public.shifts s
  join public.venues v on v.id = s.venue_id
  where s.status = 'open'
    and s.starts_at > now()
    and (p_lat is null or s.lat is null or public.distance_km(p_lat, p_lng, s.lat, s.lng) <= p_km)
  order by 10 asc nulls last, s.starts_at asc
$$;

-- Staff and venue owners may only move an application to the statuses that are theirs to set.
create or replace function public.guard_application() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;               -- service role / admin
  if new.shift_id <> old.shift_id or new.staff_id <> old.staff_id then
    raise exception 'An application cannot be moved to another shift or person';
  end if;
  if old.staff_id = auth.uid() then
    if new.status <> 'withdrawn' then raise exception 'Staff can only withdraw an application'; end if;
  elsif public.owns_shift(old.shift_id) then
    if new.status not in ('shortlisted', 'booked', 'declined') then
      raise exception 'Venues can only shortlist, book or decline';
    end if;
  else
    raise exception 'Not allowed';
  end if;
  return new;
end $$;

create trigger applications_guard before update on public.applications
  for each row execute function public.guard_application();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.staff_private enable row level security;
alter table public.venues        enable row level security;
alter table public.shifts        enable row level security;
alter table public.applications  enable row level security;
alter table public.availability  enable row level security;

-- Profiles: you see yourself; approved employers see staff profiles; venues see staff who applied to them.
create policy "profiles: read own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles: employers read staff" on public.profiles for select to authenticated
  using (role = 'staff' and public.is_approved_employer());
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Column-level limits: users can't change their role or verification status themselves.
revoke update on public.profiles from authenticated;
grant update (first_name, last_name, gender, date_of_birth, email, phone, confirmed_by, photo_path, address, lat, lng,
              travel_km, positions, cv_path, onboarded_at)
  on public.profiles to authenticated;

-- Private staff data: owner only.
create policy "staff_private: owner" on public.staff_private for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Submitting ID details moves the profile to "pending" for checking.
create or replace function public.mark_rtw_pending() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.id_number is not null or new.id_doc_path is not null then
    update public.profiles set rtw_status = 'pending'
    where id = new.id and rtw_status in ('not_submitted', 'rejected');
  end if;
  return new;
end $$;
create trigger staff_private_rtw after insert or update on public.staff_private
  for each row execute function public.mark_rtw_pending();

-- Venues: owners manage their own; everyone signed in can see approved venues.
create policy "venues: read approved or own" on public.venues for select to authenticated
  using (approved or owner_id = auth.uid());
create policy "venues: create own" on public.venues for insert to authenticated
  with check (owner_id = auth.uid() and approved = false
              and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'employer'));
create policy "venues: update own" on public.venues for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
revoke update on public.venues from authenticated;
grant update (kind, name, area, lat, lng) on public.venues to authenticated;

-- Shifts: staff see open shifts from approved venues; owners manage their own (posting allowed before approval).
create policy "shifts: read open from approved venues" on public.shifts for select to authenticated
  using (
    (status = 'open' and exists (select 1 from public.venues v where v.id = venue_id and v.approved))
    or exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid())
  );
create policy "shifts: owner insert" on public.shifts for insert to authenticated
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid()));
create policy "shifts: owner update" on public.shifts for update to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid()));
create policy "shifts: owner delete" on public.shifts for delete to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid()));

-- Applications: staff apply to open shifts and see their own; venue owners see and update theirs.
create policy "applications: staff read own" on public.applications for select to authenticated
  using (staff_id = auth.uid());
create policy "applications: owner read" on public.applications for select to authenticated
  using (public.owns_shift(shift_id));
create policy "applications: staff apply" on public.applications for insert to authenticated
  with check (
    staff_id = auth.uid() and status = 'applied'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'staff')
    and exists (select 1 from public.shifts s join public.venues v on v.id = s.venue_id
                where s.id = shift_id and s.status = 'open' and v.approved and s.starts_at > now())
  );
create policy "applications: staff or owner update" on public.applications for update to authenticated
  using (staff_id = auth.uid() or public.owns_shift(shift_id));
revoke update on public.applications from authenticated;
grant update (status) on public.applications to authenticated;

-- Venue owners can see the profiles of people who applied to their shifts, even before approval.
create policy "profiles: owners read applicants" on public.profiles for select to authenticated
  using (exists (select 1 from public.applications a where a.staff_id = profiles.id and public.owns_shift(a.shift_id)));

-- Availability: owner only.
create policy "availability: owner" on public.availability for all to authenticated
  using (staff_id = auth.uid()) with check (staff_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: profile photos (readable by signed-in users) and private documents (owner only).
-- Files go in a folder named after the user's id: <user id>/<file>.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;

create policy "photos: owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos: signed-in read" on storage.objects for select to authenticated
  using (bucket_id = 'photos');
create policy "documents: owner all" on storage.objects for all to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
