-- Sample data for a development or staging database ONLY. Never run this on production.
-- Creates one approved demo venue with a few open shifts so staff screens have something to show.
-- Run in the Supabase SQL editor, or automatically with `supabase db reset` when using the Supabase CLI.

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values ('00000000-0000-4000-8000-0000000000e1', 'demo-venue@example.com', '{"first_name":"Demo","role":"employer"}', 'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into public.venues (id, owner_id, kind, name, area, lat, lng, approved) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000e1', 'business', 'Sample Bistro (demo)', 'Woodstock', -33.9268, 18.4475, true),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000e1', 'business', 'Sample Events Co. (demo)', 'Sea Point', -33.9180, 18.3880, true)
on conflict (id) do nothing;

insert into public.shifts (venue_id, role, starts_at, ends_at, pay_cents, area, lat, lng, description, bring) values
  ('00000000-0000-4000-8000-0000000000a1', 'Bartender',  date_trunc('day', now()) + interval '3 days 17 hours', date_trunc('day', now()) + interval '3 days 22 hours', 45000, 'Woodstock', -33.9268, 18.4475, 'Cocktail service for a 60-cover dinner.', '{"Black shirt","Wine key"}'),
  ('00000000-0000-4000-8000-0000000000a1', 'Waiter',     date_trunc('day', now()) + interval '4 days 17 hours', date_trunc('day', now()) + interval '4 days 22 hours 30 minutes', 65000, 'Woodstock', -33.9268, 18.4475, 'Busy Saturday dinner service.', '{"Black shirt","Closed shoes"}'),
  ('00000000-0000-4000-8000-0000000000a2', 'Waitress',   date_trunc('day', now()) + interval '6 days 12 hours', date_trunc('day', now()) + interval '6 days 18 hours', 60000, 'Sea Point', -33.9180, 18.3880, 'Outdoor wedding lunch, canapé and table service.', '{"White shirt","Closed shoes"}'),
  ('00000000-0000-4000-8000-0000000000a2', 'Dishwasher', date_trunc('day', now()) + interval '5 days 17 hours', date_trunc('day', now()) + interval '5 days 23 hours', 38000, 'Sea Point', -33.9180, 18.3880, 'Evening service in a busy kitchen.', '{"Closed shoes"}');
