-- ============================================================
-- Bank funding raised from bonds: cash İsmayıl has actually received
-- from settled primary-issue sales of series that are still active.
-- Counted into the bank's liquidity next to deposits (bond money can
-- be lent out too). Pending trades don't count (cash unconfirmed);
-- matured/cancelled series don't count (principal repaid / never sold).
-- Aggregate only — no identities — so it is safe for the public
-- /ismayilbank liquidity snapshot (anon), like the deposit/loan totals.
-- ============================================================
create or replace function public.bond_funding_azn()
returns numeric
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(t.units * t.price), 0)
  from public.bond_trades t
  join public.bond_series s on s.id = t.series_id
  where t.counterparty_kind = 'primary'
    and t.status = 'settled'
    and s.status = 'active'
$$;

revoke execute on function public.bond_funding_azn() from public;
grant  execute on function public.bond_funding_azn() to anon, authenticated;
