-- ============================================================
-- İsmayılBank: in-app payment reminders.
--
-- A daily Vercel cron (/api/payment-reminders) reads each account's payment
-- schedule from the Google Sheet and, for any *unpaid* installment due in
-- exactly 7 days / 1 day — or already overdue — inserts an in-app notification
-- (rendered by the existing bell). The cron runs with the public anon key (no
-- service-role key exists), so the insert path is a secret-gated SECURITY
-- DEFINER RPC: same threat model as refresh_fund_price(). The shared secret
-- lives in private.app_secrets (provisioned out-of-band, never committed).
-- ============================================================

-- 1. Allow the new notification kind. The original inline check (in
--    20260522134928_market_orders_notifications.sql) only permits match/settled.
alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('match', 'settled', 'payment_due'));

-- 2. Idempotency key so a cron retry / double-run can't send a reminder twice.
--    Nullable: existing (trade) notifications keep NULL; NULLs are distinct in a
--    unique index, so they never collide. The RPC namespaces the key per user.
alter table public.notifications
  add column if not exists dedupe_key text;
create unique index if not exists notifications_dedupe_key_key
  on public.notifications (dedupe_key);

-- 3. Secret-gated insert RPC. Resolves the Sheet account name -> auth user
--    (PII read, hence definer; never exposed to clients), then inserts.
create or replace function public.create_payment_notification(
  p_name          text,
  p_title         text,
  p_body          text,
  p_dedupe_suffix text,
  p_secret        text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_uid    uuid;
  v_key    text;
  v_ins    uuid;
begin
  -- Authorize via shared secret. anon may call this RPC, so the secret — not
  -- the role — is the real guard. No secret provisioned yet => reject (safe).
  select value into v_secret
    from private.app_secrets
   where name = 'payment_reminder_secret';

  if v_secret is null or p_secret is null or p_secret <> v_secret then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Map the account name to a Supabase user (same norm() match as
  -- fund_admin_user_id). No linked user => nothing to notify; skip quietly.
  select u.id into v_uid
    from auth.users u
   where public.norm(coalesce(
           u.raw_user_meta_data ->> 'full_name',
           u.raw_user_meta_data ->> 'name',
           u.raw_user_meta_data ->> 'display_name', '')) = public.norm(p_name)
   order by u.created_at
   limit 1;

  if v_uid is null then
    return false;
  end if;

  -- Namespace the dedupe key per user so two accounts can share a due
  -- date + bucket without colliding.
  v_key := v_uid::text || ':' || coalesce(p_dedupe_suffix, '');

  insert into public.notifications (user_id, kind, title, body, dedupe_key)
  values (v_uid, 'payment_due', p_title, p_body, v_key)
  on conflict (dedupe_key) do nothing
  returning id into v_ins;

  return v_ins is not null; -- true = inserted, false = duplicate (already sent)
end;
$$;

revoke execute on function
  public.create_payment_notification(text, text, text, text, text) from public;
grant execute on function
  public.create_payment_notification(text, text, text, text, text) to anon, authenticated;

-- Provision the secret out-of-band (NOT in this migration), e.g.:
--   insert into private.app_secrets (name, value)
--   values ('payment_reminder_secret', '<random>')
--   on conflict (name) do update set value = excluded.value;
-- and set the matching PAYMENT_REMINDER_SECRET env in Vercel + .env.local.
