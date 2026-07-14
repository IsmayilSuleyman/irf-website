-- ============================================================
-- Per-series bond funding breakdown for the liquidity projection:
-- how many units of each ACTIVE series are settled-sold, the cash
-- raised, and the coupon/maturity parameters needed to project the
-- bank's future outflows. Aggregates only (no holder identities);
-- for the signed-in Ümumbank view, so authenticated-only.
-- ============================================================
create or replace function public.bond_funding_breakdown()
returns table(
  name                 text,
  settled_units        int,
  proceeds_azn         numeric,
  face_value_azn       numeric,
  coupon_rate_pct      numeric,
  coupon_period_months int,
  issue_date           date,
  maturity_date        date)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.name,
         coalesce(sum(t.units), 0)::int as settled_units,
         coalesce(sum(t.units * t.price), 0) as proceeds_azn,
         s.face_value_azn, s.coupon_rate_pct, s.coupon_period_months,
         s.issue_date, s.maturity_date
  from public.bond_series s
  left join public.bond_trades t
    on t.series_id = s.id
   and t.counterparty_kind = 'primary'
   and t.status = 'settled'
  where s.status = 'active'
  group by s.id, s.name, s.face_value_azn, s.coupon_rate_pct,
           s.coupon_period_months, s.issue_date, s.maturity_date
$$;

revoke execute on function public.bond_funding_breakdown() from public, anon;
grant  execute on function public.bond_funding_breakdown() to authenticated;
