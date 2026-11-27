-- ============================================================
-- Close the anonymous write hole on price_history; make fund_settings
-- writes admin-only.
--
-- price_history is the fund's daily unit-price (NAV) series behind every
-- chart, day-change and period-return figure. Live state before this
-- migration (dumped from prod 2026-11-27):
--   policy  allow_all  to public, for ALL, using (true) with check (true)
--   grants  anon + authenticated: SELECT, INSERT, UPDATE, DELETE,
--           TRUNCATE, REFERENCES, TRIGGER
-- The anon key ships to every browser, so anyone could insert, rewrite or
-- delete NAV history through PostgREST with no sign-in. Its only writer
-- was the daily /api/record-price cron, which upserted with that same
-- anon key. That was the only reason the policy was open.
--
-- After:
--   * Reads are unchanged: SELECT stays open to anon + authenticated
--     (lib/priceHistory.ts reads with the anon key).
--   * The only write path is record_price_cron(), a SECURITY DEFINER RPC
--     gated by the shared cron secret in private.app_secrets
--     ('payment_reminder_secret'). That is the same trust domain as
--     record_momentum_week_cron, which already runs on this same cron
--     with the same PAYMENT_REMINDER_SECRET env var. Nothing new to
--     provision: the Monday momentum rows landing at 01:59 Baku prove
--     the cron's secret matches. The secret, not the role, is the guard.
--     recorded_at is the Baku date computed here, so even a caller with
--     the secret can only write today's row.
--   * allow_all is dropped, and anon/authenticated keep SELECT only.
--
-- fund_settings: "fund_settings write" (to authenticated, for ALL, true)
-- let ANY signed-in account, external members included, change any key:
-- bank_founder_mode (switches the founder's interest accrual for
-- everyone), the buy ticket's weekly_budget_azn and purchase_cadence,
-- and strategy_statement. Every writer in the app is already admin-only:
--   setFounderMode                      → is_fund_admin()
--   saveWeeklyBudget/savePurchaseCadence → OWNER_EMAIL, which is the
--                                          one admin_users account
--                                          (checked in prod 2026-11-27)
-- The policy now enforces the same thing: writes need is_fund_admin().
-- Reads ("fund_settings read", public, true) are untouched.
--
-- Postgres-owned SECURITY DEFINER functions and the SQL editor bypass RLS
-- and are unaffected.
--
-- Deploy order: ship the app first. The record-price route falls back to
-- the old direct upsert while this RPC does not exist yet (PGRST202), so
-- the nightly row keeps landing either way. Applying this migration
-- before the deploy would make that night's old-code upsert fail.
-- ============================================================

-- === price_history ===========================================

alter table public.price_history enable row level security;

drop policy if exists allow_all on public.price_history;
drop policy if exists "price_history read" on public.price_history;
create policy "price_history read" on public.price_history
  for select to anon, authenticated using (true);

revoke all on table public.price_history from anon, authenticated;
grant select on table public.price_history to anon, authenticated;
revoke all on sequence public.price_history_id_seq from anon, authenticated;

create or replace function public.record_price_cron(
  p_price  numeric,
  p_label  text,
  p_secret text
)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_secret text;
  v_day    date;
  v_label  text;
begin
  select value into v_secret
    from private.app_secrets
   where name = 'payment_reminder_secret';

  if v_secret is null or p_secret is null or p_secret <> v_secret then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- A blank Sheet cell parses to 0, and a 0 row would turn every day
  -- change into -100 %. NaN and Infinity sort above every number in
  -- Postgres, so the upper bound rejects them too.
  if p_price is null or not (p_price > 0 and p_price < 1000000) then
    raise exception 'implausible unit price: %', p_price using errcode = '22023';
  end if;

  -- The label comes from the app (Node's en-GB short date, e.g.
  -- "27 Nov 26" / "01 Sept 26"). Postgres to_char would print "Sep" and
  -- break the series' format.
  v_label := btrim(coalesce(p_label, ''));
  if v_label = '' or length(v_label) > 32 then
    raise exception 'bad label' using errcode = '22023';
  end if;

  v_day := (now() at time zone 'Asia/Baku')::date;

  insert into public.price_history (label, price, recorded_at)
  values (v_label, p_price, v_day)
  on conflict (recorded_at) do update
     set label = excluded.label,
         price = excluded.price;

  return json_build_object(
    'ok', true,
    'recorded_at', v_day,
    'label', v_label,
    'price', p_price
  );
end; $$;

revoke execute on function public.record_price_cron(numeric, text, text) from public;
grant  execute on function public.record_price_cron(numeric, text, text) to anon, authenticated;

-- === fund_settings ===========================================

drop policy if exists "fund_settings write" on public.fund_settings;
drop policy if exists "fund_settings admin insert" on public.fund_settings;
drop policy if exists "fund_settings admin update" on public.fund_settings;
drop policy if exists "fund_settings admin delete" on public.fund_settings;

create policy "fund_settings admin insert" on public.fund_settings
  for insert to authenticated
  with check ((select public.is_fund_admin()));

create policy "fund_settings admin update" on public.fund_settings
  for update to authenticated
  using ((select public.is_fund_admin()))
  with check ((select public.is_fund_admin()));

create policy "fund_settings admin delete" on public.fund_settings
  for delete to authenticated
  using ((select public.is_fund_admin()));

-- anon never writes; authenticated keeps only what RLS can gate (TRUNCATE
-- ignores RLS, and REFERENCES/TRIGGER have no use here).
revoke all on table public.fund_settings from anon, authenticated;
grant select on table public.fund_settings to anon, authenticated;
grant insert, update, delete on table public.fund_settings to authenticated;
