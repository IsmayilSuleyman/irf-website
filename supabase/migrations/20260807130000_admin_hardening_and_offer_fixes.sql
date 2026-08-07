-- ============================================================
-- Two security fixes from the credit-offer review, one of them platform-wide.
--
-- 1) is_fund_admin() trusted auth.jwt()->'user_metadata' — the 'role' claim
--    and the display name. Supabase lets any signed-in user rewrite their own
--    user_metadata via auth.updateUser(), so ANY holder could grant
--    themselves admin (set role='admin', or rename to the principal) and
--    unlock every admin RPC and RLS branch in the app. The gate now checks a
--    server-controlled public.admin_users table keyed by auth.uid(): no
--    client-writable input remains in the decision. Seeded from the one auth
--    user whose display name norm-matches fund_config.principal_name — the
--    migration ABORTS if that finds nobody, so it cannot lock İsmayıl out.
--    To add an admin later: insert their auth.users id into admin_users.
--
-- 2) credit_offer_interest returned the admin's push-subscription secrets
--    (endpoint/p256dh/auth) and unread count to ANY authenticated caller with
--    an offer row — the only path around push_subscriptions' own RLS. The
--    RPC now returns only {sent, already}; the web-push data moves to
--    admin_push_context(p_secret), gated by the shared cron secret exactly
--    like sync_payment_notifications, callable only by the server route.
--    While here: a fixed-amount (azn) offer's ping amount is validated
--    against the stored rule, so a direct RPC caller cannot forge the figure
--    İsmayıl sees; a pct offer's figure is resolved from sheet liquidity the
--    database cannot see, so it stays bounded-but-unverifiable (the ping is
--    advisory — İsmayıl checks before lending).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Server-controlled admin registry.
-- ------------------------------------------------------------
create table if not exists public.admin_users (
  user_id  uuid primary key,
  note     text,
  added_at timestamptz not null default now()
);

-- Definer functions read it as the table owner; clients never touch it.
alter table public.admin_users enable row level security;
revoke all on public.admin_users from public, anon, authenticated;

insert into public.admin_users (user_id, note)
select u.id, 'seeded from fund_config.principal_name (admin hardening)'
from auth.users u
where public.norm(coalesce(
        u.raw_user_meta_data ->> 'full_name',
        u.raw_user_meta_data ->> 'name',
        u.raw_user_meta_data ->> 'display_name', ''))
      = (select public.norm(principal_name) from public.fund_config where id = 1)
on conflict (user_id) do nothing;

-- Abort (and roll the whole migration back) rather than ship an empty
-- registry that would lock the admin out of his own cabinet.
do $$
begin
  if not exists (select 1 from public.admin_users) then
    raise exception 'admin_users seed matched no auth user — aborting';
  end if;
end $$;

-- Same signature, same grants (preserved by create-or-replace); every RPC
-- and RLS policy that calls this is hardened at once.
create or replace function public.is_fund_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  )
$$;

-- ------------------------------------------------------------
-- 2a. Interest ping: no secrets in the reply, azn amounts verified.
-- ------------------------------------------------------------
create or replace function public.credit_offer_interest(p_amount_azn numeric)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid    uuid := auth.uid();
  v_holder text;
  v_offer  record;
  v_admin  uuid;
  v_key    text;
  v_inserted boolean := false;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  v_holder := coalesce(
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() -> 'user_metadata' ->> 'name',
    auth.jwt() -> 'user_metadata' ->> 'display_name');
  if v_holder is null or btrim(v_holder) = '' then
    raise exception 'Hesabınızda ad göstərilməyib';
  end if;
  if p_amount_azn is null or p_amount_azn <= 0 or p_amount_azn > 1000000 then
    raise exception 'Yanlış məbləğ';
  end if;

  select o.* into v_offer
  from public.credit_offers o
  where public.norm(o.holder_name) = public.norm(v_holder)
  limit 1;
  if not found then
    raise exception 'Sizin üçün aktiv kredit təklifi yoxdur';
  end if;
  -- Fixed offers: the pinged figure must BE the offer.
  if v_offer.mode = 'azn' and p_amount_azn <> floor(v_offer.value) then
    raise exception 'Yanlış məbləğ';
  end if;

  v_admin := public.fund_admin_user_id();
  if v_admin is null then
    return json_build_object('sent', false, 'already', false);
  end if;

  v_key := 'credit-interest:' || public.norm(v_holder) || ':'
        || ((now() at time zone 'Asia/Baku')::date)::text;

  insert into public.notifications (user_id, kind, title, body, dedupe_key)
  values (
    v_admin,
    'announcement',
    'Kredit təklifinə maraq',
    format('%s %s ₼ məbləğində kredit təklifi ilə maraqlanır.',
           btrim(v_holder), to_char(p_amount_azn, 'FM999999990')),
    v_key
  )
  on conflict (dedupe_key) do nothing
  returning true into v_inserted;
  v_inserted := coalesce(v_inserted, false);

  return json_build_object('sent', v_inserted, 'already', not v_inserted);
end; $$;

-- ------------------------------------------------------------
-- 2b. Push context for the server route only (cron-secret gated).
-- ------------------------------------------------------------
create or replace function public.admin_push_context(p_secret text)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_secret text;
  v_admin  uuid;
  v_unread int := 0;
  v_subs   jsonb := '[]'::jsonb;
begin
  select value into v_secret
    from private.app_secrets
   where name = 'payment_reminder_secret';
  if v_secret is null or p_secret is null or p_secret <> v_secret then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  v_admin := public.fund_admin_user_id();
  if v_admin is null then
    return json_build_object('unread', 0, 'subs', '[]'::jsonb);
  end if;

  select count(*) into v_unread from public.notifications
  where user_id = v_admin and read = false
    and created_at >= now() - interval '3 days';

  select coalesce(jsonb_agg(jsonb_build_object(
    'endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth)), '[]'::jsonb)
  into v_subs
  from public.push_subscriptions ps where ps.user_id = v_admin;

  return json_build_object('unread', v_unread, 'subs', v_subs);
end; $$;

-- ------------------------------------------------------------
-- 2c. Clearer cap message (was malformed Azerbaijani and reachable).
-- ------------------------------------------------------------
create or replace function public.admin_set_credit_offer(
  p_holder text,
  p_mode   text,
  p_value  numeric
)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_fund_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_holder is null or btrim(p_holder) = '' then
    raise exception 'Hesab adı tələb olunur';
  end if;
  if p_mode not in ('azn', 'pct') then
    raise exception 'Rejim azn və ya pct olmalıdır';
  end if;
  if p_value is null or p_value <= 0 then
    raise exception 'Məbləğ müsbət olmalıdır';
  end if;
  if p_mode = 'pct' and p_value > 100 then
    raise exception 'Faiz 100-dən böyük ola bilməz';
  end if;
  if p_mode = 'azn' and p_value > 1000000 then
    raise exception 'Məbləğ 1.000.000 ₼ həddini aşır';
  end if;

  insert into public.credit_offers (holder_name, mode, value, updated_at, updated_by)
  values (btrim(p_holder), p_mode, p_value, now(), auth.uid())
  on conflict (holder_name) do update
    set mode = excluded.mode,
        value = excluded.value,
        updated_at = now(),
        updated_by = excluded.updated_by;

  return json_build_object('ok', true);
end; $$;

-- ------------------------------------------------------------
-- Privileges.
-- ------------------------------------------------------------
revoke execute on function public.admin_push_context(text) from public, anon;
grant  execute on function public.admin_push_context(text) to anon, authenticated;
