-- Postgres lets everyone (PUBLIC) run new functions by default. Take that away and grant only what's needed.
alter function public.touch_updated_at() set search_path = public;

-- Trigger functions: never called directly.
revoke execute on function public.touch_updated_at()   from public, anon, authenticated;
revoke execute on function public.handle_new_user()    from public, anon, authenticated;
revoke execute on function public.guard_application()  from public, anon, authenticated;
revoke execute on function public.mark_rtw_pending()   from public, anon, authenticated;

-- Helpers used inside security rules and by the app: signed-in users only.
revoke execute on function public.is_admin()                              from public, anon;
revoke execute on function public.is_approved_employer()                  from public, anon;
revoke execute on function public.owns_shift(uuid)                        from public, anon;
revoke execute on function public.shifts_near(float8, float8, float8)     from public, anon;
revoke execute on function public.distance_km(float8, float8, float8, float8) from public, anon;
grant execute on function public.is_admin()                               to authenticated;
grant execute on function public.is_approved_employer()                   to authenticated;
grant execute on function public.owns_shift(uuid)                         to authenticated;
grant execute on function public.shifts_near(float8, float8, float8)      to authenticated;
grant execute on function public.distance_km(float8, float8, float8, float8) to authenticated;

-- New functions start locked; grant explicitly in future migrations.
alter default privileges in schema public revoke execute on functions from public, anon;
