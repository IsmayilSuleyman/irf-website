-- Ümumbank baxışı transparency round:
--   1. bank_unsettled_totals() — aggregate-only unsettled/settled sums of the
--      daily-interest and daily-reward ledgers, readable by EVERY signed-in
--      holder (per-row RLS on those tables is own-or-admin, so a non-admin
--      could never assemble the bank-wide totals from raw rows).
--   2. bank_daily_snapshots — one row per Baku day of the bank's headline
--      figures, written by pg_cron via /api/record-bank-daily so long-term
--      trends exist even when nobody opens the site. Kept forever (tiny).
--
-- The pg_cron job is scheduled OUT OF BAND (it carries the deployment URL),
-- documented here for the record — three firings per Baku day, the date PK
-- makes the first success win and later firings harmless retries:
--   select cron.schedule('irf-bank-daily-snapshot', '5 21,3,9 * * *', $cron$
--     select net.http_get(
--       url := 'https://<deployment>/api/record-bank-daily',
--       headers := jsonb_build_object('Authorization',
--         'Bearer ' || (select decrypted_secret
--                        from vault.decrypted_secrets
--                        where name = 'minute-cron-bearer')),
--       timeout_milliseconds := 8000);
--   $cron$);

-- === 1. Aggregate-only unsettled totals ==================================
-- Returns ONLY non-identifying sums (the order_book()/bond_funding_azn()
-- precedent): no holder names, no per-person figures.
create or replace function public.bank_unsettled_totals()
returns json
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select json_build_object(
    'interest_unsettled', coalesce((select sum(amount_azn)
      from public.bank_interest_accruals where settled_at is null), 0),
    'interest_settled', coalesce((select sum(amount_azn)
      from public.bank_interest_accruals where settled_at is not null), 0),
    'rewards_unsettled', coalesce((select sum(amount_azn)
      from public.daily_reward_claims where settled_at is null), 0),
    'rewards_settled', coalesce((select sum(amount_azn)
      from public.daily_reward_claims where settled_at is not null), 0)
  );
$$;

revoke all on function public.bank_unsettled_totals() from public, anon;
grant execute on function public.bank_unsettled_totals() to authenticated;

-- === 2. Daily bank snapshots =============================================
create table if not exists public.bank_daily_snapshots (
  snapshot_date date primary key,
  taken_at timestamptz not null default now(),
  deposits_azn numeric not null check (deposits_azn >= 0),
  loans_azn numeric not null check (loans_azn >= 0),
  bond_funding_azn numeric not null default 0 check (bond_funding_azn >= 0),
  asset_reserve_azn numeric not null default 0 check (asset_reserve_azn >= 0),
  net_liquidity_azn numeric not null,
  unsettled_interest_azn numeric not null default 0,
  unsettled_rewards_azn numeric not null default 0
);

alter table public.bank_daily_snapshots enable row level security;

drop policy if exists "bank_daily_snapshots read" on public.bank_daily_snapshots;
create policy "bank_daily_snapshots read" on public.bank_daily_snapshots
  for select to authenticated using (true);

revoke all on table public.bank_daily_snapshots from anon, authenticated;
grant select on table public.bank_daily_snapshots to authenticated;

-- Vault-bearer-gated writer (same identity as record_minute_snapshot). The
-- route only sends what Postgres cannot see — the Google-Sheet side
-- (deposits, loans, the asset reserve). Bond funding and the unsettled
-- ledger sums are computed HERE so they can never drift from the
-- database's own truth. The snapshot day is computed in-database; the
-- caller never picks the period.
create or replace function public.record_bank_daily_snapshot(
  p_secret text,
  p_deposits_azn numeric,
  p_loans_azn numeric,
  p_asset_reserve_azn numeric default 0
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expected text;
  v_day date;
  v_bond numeric;
  v_interest numeric;
  v_rewards numeric;
  v_inserted boolean;
begin
  select decrypted_secret into v_expected
  from vault.decrypted_secrets where name = 'minute-cron-bearer';
  if v_expected is null or p_secret is distinct from v_expected then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_deposits_azn is null or p_deposits_azn < 0
     or p_loans_azn is null or p_loans_azn < 0 then
    raise exception 'invalid snapshot values';
  end if;

  v_day := (now() at time zone 'Asia/Baku')::date;
  v_bond := coalesce(public.bond_funding_azn(), 0);
  select coalesce(sum(amount_azn), 0) into v_interest
    from public.bank_interest_accruals where settled_at is null;
  select coalesce(sum(amount_azn), 0) into v_rewards
    from public.daily_reward_claims where settled_at is null;

  insert into public.bank_daily_snapshots (
    snapshot_date, deposits_azn, loans_azn, bond_funding_azn,
    asset_reserve_azn, net_liquidity_azn,
    unsettled_interest_azn, unsettled_rewards_azn
  ) values (
    v_day, p_deposits_azn, p_loans_azn, v_bond,
    greatest(coalesce(p_asset_reserve_azn, 0), 0),
    p_deposits_azn + v_bond - p_loans_azn,
    v_interest, v_rewards
  )
  on conflict (snapshot_date) do nothing;
  v_inserted := found;

  return json_build_object('recorded', v_inserted, 'snapshot_date', v_day);
end;
$$;

revoke all on function public.record_bank_daily_snapshot(text, numeric, numeric, numeric) from public;
grant execute on function public.record_bank_daily_snapshot(text, numeric, numeric, numeric) to anon, authenticated;
