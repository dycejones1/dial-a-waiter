-- Adds the "admin" role for Dial A Waiter's own team (account managers).
-- Kept in its own file: a new enum value must be committed before other statements can use it.
alter type public.user_role add value if not exists 'admin';
