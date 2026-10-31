-- ============================================================
-- Google sign-in, round two: open sign-in, approval by İsmayıl.
--
-- Round one (20261101120000) assumed invite-only Google login: İsmayıl
-- pre-creates the e-mail, pins the name, the member signs in. The flow is
-- now self-service instead:
--
--   1. Anyone with a Google account can sign in ("Allow new users to sign
--      up" must be ON). Supabase creates the auth user.
--   2. The auth server is never allowed to write a NAME (full_name / name /
--      display_name) — not on insert, not on update. A new user therefore
--      has no name at all, and since every holder lookup in the app and in
--      the RPCs keys on user_metadata.full_name, a nameless user matches
--      nothing: no sheet row, no holdings, no offers. Inert by construction.
--   3. The app sends nameless users to /register, where they type Ad +
--      Soyad (public.registrations) and wait. İsmayıl gets a notification
--      (bell + push).
--   4. In the cabinet İsmayıl either
--        a) LINKS the request to an existing profile — e.g. Subhan decides to
--           use his Google account from now on: the Google identity row is
--           moved onto Subhan's existing auth user and the placeholder user
--           is deleted. Subhan signs in with Google and lands in his own
--           account, name and history intact; or
--        b) APPROVES it as a new account — sets full_name (editable, so the
--           spelling can match the bank sheet) and optionally flags the
--           login as an external member; or
--        c) REJECTS it — the placeholder auth user is deleted.
--
-- "Approved" is not a flag: it is "has a full_name", and after this
-- migration only postgres (the SQL editor, or the admin RPCs below, which
-- are security-definer functions owned by postgres) can write one.
--
-- Pre-flight (read-only, verified live 2026-10-31): 20261031120000 and
-- 20261101120000 are NOT yet applied to production — apply them first, in
-- order; pin_full_name is replaced here with the stricter rule;
-- has_table_privilege('postgres', 'auth.identities', 'UPDATE') and
-- ('auth.users', 'DELETE') are both true; none of the objects below exist.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The auth server never writes a name.
-- ------------------------------------------------------------
create or replace function public.pin_full_name()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_pinned text;
begin
  -- Only the auth server (GoTrue connects as supabase_auth_admin) is
  -- restricted. postgres — İsmayıl in the SQL editor, and the definer RPCs
  -- below — must stay able to set and correct names.
  if session_user <> 'supabase_auth_admin' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_pinned := nullif(btrim(old.raw_user_meta_data ->> 'full_name'), '');
  end if;

  -- Drop whatever name the provider (or auth.updateUser) sent; keep the
  -- rest (picture, email_verified, sub, …); restore the pinned name if any.
  new.raw_user_meta_data :=
    (coalesce(new.raw_user_meta_data, '{}'::jsonb)
       - 'full_name' - 'name' - 'display_name')
    || case when v_pinned is null then '{}'::jsonb
            else jsonb_build_object('full_name', v_pinned) end;

  return new;
end;
$$;

comment on function public.pin_full_name() is
  'BEFORE INSERT OR UPDATE on auth.users: supabase_auth_admin (OAuth logins, sign-ups, auth.updateUser) can never set or change full_name/name/display_name; only postgres can.';

revoke all on function public.pin_full_name() from public, anon, authenticated;
grant execute on function public.pin_full_name() to supabase_auth_admin;

drop trigger if exists pin_full_name on auth.users;
create trigger pin_full_name
  before insert or update on auth.users
  for each row
  execute function public.pin_full_name();

-- ------------------------------------------------------------
-- 2. Pending registrations: one row per nameless login that filled the form.
-- ------------------------------------------------------------
create table if not exists public.registrations (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  email        text,
  first_name   text not null,
  last_name    text not null,
  requested_at timestamptz not null default now()
);

alter table public.registrations enable row level security;
revoke all on public.registrations from public, anon, authenticated;

-- ------------------------------------------------------------
-- 3. Member side.
-- ------------------------------------------------------------

-- One call answers both gates the app has: is this login approved (has a
-- name) and is it an external member. Read from auth.users, not the JWT:
-- the token issued before approval has no name until it refreshes.
create or replace function public.my_access()
returns json
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_uid   uuid := auth.uid();
  v_name  text;
  v_email text;
  v_reg   public.registrations%rowtype;
begin
  if v_uid is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), u.email::text
    into v_name, v_email
    from auth.users u where u.id = v_uid;

  select * into v_reg from public.registrations r where r.user_id = v_uid;

  return json_build_object(
    'status', case
      when v_name is not null then 'approved'
      when v_reg.user_id is not null then 'pending'
      else 'unregistered' end,
    'external', exists (select 1 from public.external_users e where e.user_id = v_uid),
    'email', v_email,
    'first_name', v_reg.first_name,
    'last_name', v_reg.last_name
  );
end;
$$;

revoke all on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

-- The /register form. Re-submitting overwrites the pending row (typo fix).
-- Approved users (named) are refused: they have nothing to register.
-- Returns true when the row is NEW — the caller pings the admin only then.
create or replace function public.submit_registration(
  p_first_name text,
  p_last_name  text
)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid   uuid := auth.uid();
  v_first text := regexp_replace(btrim(coalesce(p_first_name, '')), '\s+', ' ', 'g');
  v_last  text := regexp_replace(btrim(coalesce(p_last_name,  '')), '\s+', ' ', 'g');
  v_email text;
  v_admin uuid;
  v_new   boolean;
begin
  if v_uid is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_first = '' or v_last = '' then
    raise exception 'Ad və soyad boş ola bilməz';
  end if;
  if length(v_first) > 60 or length(v_last) > 60 then
    raise exception 'Ad və ya soyad çox uzundur';
  end if;

  select u.email::text into v_email from auth.users u
   where u.id = v_uid
     and nullif(btrim(u.raw_user_meta_data ->> 'full_name'), '') is null;
  if not found then
    raise exception 'Bu giriş artıq təsdiqlənib';
  end if;

  v_new := not exists (select 1 from public.registrations r where r.user_id = v_uid);

  insert into public.registrations (user_id, email, first_name, last_name)
  values (v_uid, v_email, v_first, v_last)
  on conflict (user_id) do update
     set first_name   = excluded.first_name,
         last_name    = excluded.last_name,
         email        = excluded.email,
         requested_at = now();

  -- Bell for İsmayıl (the push is sent by the server action, same as the
  -- credit-offer ping). One bell per login, however often the form is
  -- re-submitted.
  v_admin := public.fund_admin_user_id();
  if v_admin is not null then
    insert into public.notifications (user_id, kind, title, body, dedupe_key)
    values (
      v_admin,
      'announcement',
      'Yeni qeydiyyat sorğusu',
      format('%s %s (%s) giriş üçün təsdiq gözləyir.', v_first, v_last, coalesce(v_email, '—')),
      'registration:' || v_uid::text
    )
    on conflict (dedupe_key) do nothing;
  end if;

  return v_new;
end;
$$;

revoke all on function public.submit_registration(text, text) from public, anon;
grant execute on function public.submit_registration(text, text) to authenticated;

-- ------------------------------------------------------------
-- 4. Admin side: the cabinet's "Qeydiyyat sorğuları" panel.
-- ------------------------------------------------------------
create or replace function public.admin_list_registrations()
returns table (
  user_id      uuid,
  email        text,
  first_name   text,
  last_name    text,
  requested_at timestamptz,
  providers    text
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_fund_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select r.user_id, r.email, r.first_name, r.last_name, r.requested_at,
         (select string_agg(i.provider, ', ' order by i.provider)
            from auth.identities i where i.user_id = r.user_id) as providers
    from public.registrations r
   order by r.requested_at;
end;
$$;

revoke all on function public.admin_list_registrations() from public, anon;
grant execute on function public.admin_list_registrations() to authenticated;

-- b) New account: give the login its name (the sheet spelling — editable in
--    the panel), optionally flag it external, close the request.
create or replace function public.admin_approve_registration(
  p_user_id   uuid,
  p_full_name text,
  p_external  boolean
)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_name text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
begin
  if not public.is_fund_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_name = '' or length(v_name) > 120 then
    raise exception 'Ad düzgün deyil';
  end if;
  if not exists (select 1 from public.registrations r where r.user_id = p_user_id) then
    raise exception 'Sorğu tapılmadı';
  end if;
  -- Two logins with one holder name would share holdings, offers and sheet
  -- rows. That case is "link to the existing profile", not a new account.
  if exists (
    select 1 from auth.users u
     where u.id <> p_user_id
       and public.norm(coalesce(u.raw_user_meta_data ->> 'full_name', '')) = public.norm(v_name)
  ) then
    raise exception 'Bu adla giriş artıq var — mövcud profilə bağlayın';
  end if;

  update auth.users
     set raw_user_meta_data =
           coalesce(raw_user_meta_data, '{}'::jsonb)
           || jsonb_build_object('full_name', v_name)
   where id = p_user_id;

  if coalesce(p_external, false) then
    insert into public.external_users (user_id, note)
    values (p_user_id, 'approved from a Google registration')
    on conflict (user_id) do nothing;
  end if;

  delete from public.registrations where user_id = p_user_id;

  return json_build_object('full_name', v_name, 'external', coalesce(p_external, false));
end;
$$;

revoke all on function public.admin_approve_registration(uuid, text, boolean) from public, anon;
grant execute on function public.admin_approve_registration(uuid, text, boolean) to authenticated;

-- a) Existing profile: move the Google identity onto the existing auth user
--    and delete the placeholder. GoTrue resolves an OAuth login by
--    (provider, provider_id) → auth.identities.user_id, so the next Google
--    sign-in lands in the existing account; its e-mail/password identity
--    keeps working too. The placeholder's sessions die with it, which is
--    why the pending page sends the member back to /login.
create or replace function public.admin_link_registration(
  p_user_id        uuid,
  p_target_user_id uuid
)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_target_name text;
  v_moved       int;
begin
  if not public.is_fund_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_user_id is null or p_target_user_id is null or p_user_id = p_target_user_id then
    raise exception 'Yanlış sorğu';
  end if;
  if not exists (select 1 from public.registrations r where r.user_id = p_user_id) then
    raise exception 'Sorğu tapılmadı';
  end if;

  select nullif(btrim(u.raw_user_meta_data ->> 'full_name'), '')
    into v_target_name
    from auth.users u where u.id = p_target_user_id;
  if v_target_name is null then
    raise exception 'Hədəf profil təsdiqlənmiş giriş deyil';
  end if;
  if exists (
    select 1 from auth.identities a
      join auth.identities b on b.provider = a.provider
     where a.user_id = p_target_user_id and b.user_id = p_user_id
  ) then
    raise exception 'Hədəf profildə bu provayderlə giriş artıq var';
  end if;

  update auth.identities
     set user_id = p_target_user_id, updated_at = now()
   where user_id = p_user_id;
  get diagnostics v_moved = row_count;
  if v_moved = 0 then
    raise exception 'Köçürüləcək giriş tapılmadı';
  end if;

  -- Cascades: sessions, refresh tokens, the registrations row.
  delete from auth.users where id = p_user_id;

  return json_build_object('target_name', v_target_name, 'moved', v_moved);
end;
$$;

revoke all on function public.admin_link_registration(uuid, uuid) from public, anon;
grant execute on function public.admin_link_registration(uuid, uuid) to authenticated;

-- c) Reject: the placeholder login goes away entirely.
create or replace function public.admin_reject_registration(p_user_id uuid)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_fund_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.registrations r where r.user_id = p_user_id) then
    raise exception 'Sorğu tapılmadı';
  end if;
  if exists (select 1 from public.admin_users a where a.user_id = p_user_id) then
    raise exception 'Admin girişi silinə bilməz';
  end if;

  delete from auth.users where id = p_user_id;
  return true;
end;
$$;

revoke all on function public.admin_reject_registration(uuid) from public, anon;
grant execute on function public.admin_reject_registration(uuid) to authenticated;
