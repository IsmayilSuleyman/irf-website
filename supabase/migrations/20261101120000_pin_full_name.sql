-- ============================================================
-- Pin holder names against OAuth logins (Google sign-in for external members).
--
-- The whole app resolves "who is this holder" from user_metadata.full_name
-- (displayNameOf in lib/user.ts; auth.jwt() -> 'user_metadata' inside
-- place_order, credit_offer_interest, …; fund_admin_user_id() is a name match
-- against fund_config.principal_name). That name is the link to the Google
-- Sheet rows — "Əli İbrahimov", exactly as İsmayıl wrote it.
--
-- Supabase copies the provider profile into raw_user_meta_data on EVERY
-- OAuth login (full_name, name, picture, …). Unprotected, Google sign-in would
--   1. break the sheet link ("Ali Ibrahimov" ≠ "Əli İbrahimov"), and
--   2. let anyone impersonate a holder by renaming their Google account —
--      the same hole the 2026-08-07 admin hardening closed for the admin flag.
--
-- THE RULE (one sentence): once a user's full_name is set, the auth server
-- can never change it; only İsmayıl (the postgres role, i.e. the SQL editor)
-- can.
--
-- Mechanics: GoTrue connects as supabase_auth_admin, the SQL editor and the
-- dashboard's SQL run as postgres. A BEFORE UPDATE trigger on auth.users
-- fires on every GoTrue write (OAuth login, auth.updateUser(), token refresh
-- bookkeeping). If the row already has a non-empty full_name and the writer
-- is supabase_auth_admin, the stored full_name is restored and the provider's
-- name / display_name are dropped so nothing can shadow it (displayNameOf
-- and admin_list_app_users read full_name first anyway). Everything else the
-- provider sends (picture, email_verified, sub, …) is kept.
--
-- Consequences worth knowing:
--   • Every current user already has full_name set and only the e-mail
--     provider (verified live on 2026-10-31), so they are all pinned today.
--   • Holders can no longer rename themselves through auth.updateUser() —
--     the app never offered that, and it was an impersonation vector.
--   • A user created WITHOUT full_name gets the Google name on first login
--     and is pinned to it from then on. So set the name BEFORE the first
--     Google login (onboarding step below). If that is missed, the fix is
--     the same statement — postgres bypasses the pin.
--   • No new table: the pinned value IS raw_user_meta_data.full_name, which
--     after this migration only postgres can write. Nothing in PR #183
--     (external_users, admin_set_external, the cabinet panel) changes.
--
-- Onboarding an external member for Google sign-in (İsmayıl, once per user):
--   1. Authentication → Users → Add user → "Send invitation" with their Gmail
--      address (no password; the invite e-mail can be ignored). Sign-ups
--      stay OFF, so only such pre-created e-mails can complete Google login.
--   2. Pin the name exactly as it appears in the Bank Accounts sheet:
--        update auth.users
--           set raw_user_meta_data =
--               coalesce(raw_user_meta_data, '{}'::jsonb)
--               || jsonb_build_object('full_name', 'Əli İbrahimov')
--         where email = 'ali@gmail.com';
--   3. Flag "Kənar üzv" in the /bank cabinet (admin_set_external).
--
-- Pre-flight (read-only, verified live before writing this file):
--   • no existing user-defined triggers on auth.users;
--   • has_table_privilege('postgres', 'auth.users', 'TRIGGER') = true;
--   • public.pin_full_name does not exist (nothing is replaced).
-- ============================================================

create or replace function public.pin_full_name()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_pinned text := nullif(btrim(old.raw_user_meta_data ->> 'full_name'), '');
begin
  -- Only the auth server is pinned; postgres (İsmayıl in the SQL editor)
  -- must stay able to set and correct names.
  if session_user <> 'supabase_auth_admin' or v_pinned is null then
    return new;
  end if;

  new.raw_user_meta_data :=
    (coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'name' - 'display_name')
    || jsonb_build_object('full_name', v_pinned);

  return new;
end;
$$;

comment on function public.pin_full_name() is
  'BEFORE UPDATE on auth.users: once full_name is set, supabase_auth_admin (OAuth logins, auth.updateUser) cannot change it; only postgres can.';

-- GoTrue (supabase_auth_admin) must be able to run the trigger function;
-- nobody else needs it.
revoke all on function public.pin_full_name() from public, anon, authenticated;
grant execute on function public.pin_full_name() to supabase_auth_admin;

drop trigger if exists pin_full_name on auth.users;
create trigger pin_full_name
  before update on auth.users
  for each row
  execute function public.pin_full_name();
