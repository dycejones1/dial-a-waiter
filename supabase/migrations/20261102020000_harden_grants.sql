-- Defence in depth: the row level security rules already protect every table, but remove table
-- permissions nobody needs. Anonymous visitors get nothing; signed-in users lose TRUNCATE/TRIGGER/REFERENCES.
revoke all on all tables in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke truncate, trigger, references on tables from authenticated;
