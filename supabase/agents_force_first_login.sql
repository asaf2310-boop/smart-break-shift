-- Force first-login for agents not linked to Supabase Auth.
-- Run in Supabase SQL Editor (production).
--
-- Effect: agents must use «כניסה ראשונה» (SMS + personal password).
-- Safe to re-run.

-- Preview who will be reset:
-- select id, display_name, email, auth_user_id, needs_password_setup
-- from agents
-- where deleted_at is null
--   and auth_user_id is null;

update agents
set
  needs_password_setup = true,
  auth_user_id = null
where deleted_at is null
  and auth_user_id is null;

-- Single agent example (אורפז דאבוש):
-- update agents
-- set needs_password_setup = true, auth_user_id = null
-- where display_name ilike '%אורפז%'
--    or email ilike '%orpaz%';
