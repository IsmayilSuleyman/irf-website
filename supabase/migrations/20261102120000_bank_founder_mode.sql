-- Təsisçi rejimi (founder mode) — the founder's Supabase-side position,
-- readable by every signed-in holder so the bank-wide view can split his
-- money out of the customer figures for everyone, not just for his own
-- session. Aggregate about ONE person — the one who runs the bank — in the
-- same spirit as bank_unsettled_totals: no other holder is named.
--
--   • bond_units: per active series, the founder's effective units (the
--     same bond_effective_units() the market uses), the cash the bank got
--     from his own primary buys, and the face value.
--   • interest_*/rewards_*: his own rows of the two daily ledgers.
--
-- The on/off switch itself is a fund_settings key (bank_founder_mode),
-- written by the setFounderMode server action behind is_fund_admin().

create or replace function public.bank_founder_position()
returns json
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with p as (
    select principal_name as raw, public.norm(principal_name) as n
    from public.fund_config
    where id = 1
  )
  select json_build_object(
    'principal_name', (select raw from p),
    'bond_units', coalesce((
      select json_agg(json_build_object(
        'series_name', s.name,
        'units', public.bond_effective_units(s.id, (select raw from p)),
        'proceeds_azn', coalesce((
          select sum(t.units * t.price)
          from public.bond_trades t, p
          where t.series_id = s.id
            and t.status = 'settled'
            and t.counterparty_kind = 'primary'
            and public.norm(t.buyer_name) = p.n), 0),
        'face_value_azn', s.face_value_azn))
      from public.bond_series s
      where s.status = 'active'), '[]'::json),
    'interest_unsettled', coalesce((
      select sum(a.amount_azn) from public.bank_interest_accruals a, p
      where a.settled_at is null and public.norm(a.holder_name) = p.n), 0),
    'interest_settled', coalesce((
      select sum(a.amount_azn) from public.bank_interest_accruals a, p
      where a.settled_at is not null and public.norm(a.holder_name) = p.n), 0),
    'rewards_unsettled', coalesce((
      select sum(c.amount_azn) from public.daily_reward_claims c, p
      where c.settled_at is null and public.norm(c.holder_name) = p.n), 0),
    'rewards_settled', coalesce((
      select sum(c.amount_azn) from public.daily_reward_claims c, p
      where c.settled_at is not null and public.norm(c.holder_name) = p.n), 0)
  );
$$;

revoke all on function public.bank_founder_position() from public, anon;
grant execute on function public.bank_founder_position() to authenticated;

insert into public.fund_settings (key, value)
values ('bank_founder_mode', 'off')
on conflict (key) do nothing;
