-- Keep the details typed at sign-up (phone, gender, date of birth) even when the person
-- confirms by tapping an email link in a different tab or browser.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  dob date;
  ph text := coalesce(new.phone, meta->>'phone');
begin
  begin dob := (meta->>'date_of_birth')::date; exception when others then dob := null; end;
  if dob is not null and (dob > current_date or dob < date '1900-01-01') then dob := null; end if;
  if ph is not null and ph !~ '^\+?[0-9]{8,15}$' then ph := null; end if;
  if ph is not null and left(ph, 1) <> '+' then ph := '+' || ph; end if;

  insert into public.profiles (id, role, first_name, last_name, email, phone, gender, date_of_birth)
  values (
    new.id,
    case when meta->>'role' = 'employer' then 'employer'::public.user_role else 'staff'::public.user_role end,
    left(coalesce(meta->>'first_name', ''), 80),
    left(meta->>'last_name', 80),
    new.email,
    ph,
    left(meta->>'gender', 40),
    dob
  )
  on conflict (id) do nothing;
  return new;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
