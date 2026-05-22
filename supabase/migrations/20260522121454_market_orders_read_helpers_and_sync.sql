-- ============================================================
-- Read helpers + admin sync. Sensitive per-holder helpers are
-- REVOKEd from clients; only my_* wrappers + aggregate status exposed.
-- ============================================================

-- Settled net holdings for a holder: opening + settled buys - settled sells.
create or replace function public.effective_units(p_holder text)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select
    coalesce((select ob.opening_units from public.opening_balances ob
              where public.norm(ob.holder_name) = public.norm(p_holder)), 0)
    + coalesce((select sum(t.units) from public.trades t
                where t.status='settled' and public.norm(t.buyer_name) = public.norm(p_holder)), 0)
    - coalesce((select sum(t.units) from public.trades t
                where t.status='settled' and public.norm(t.seller_name) = public.norm(p_holder)), 0)
$$;

-- Sellable now = settled units - units locked in open sell orders - units in pending sell trades.
create or replace function public.available_to_sell(p_holder text)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select
    public.effective_units(p_holder)
    - coalesce((select sum(o.remaining_units) from public.orders o
                where o.side='sell' and o.status in ('open','partial')
                  and public.norm(o.holder_name) = public.norm(p_holder)), 0)
    - coalesce((select sum(t.units) from public.trades t
                where t.status='pending' and public.norm(t.seller_name) = public.norm(p_holder)), 0)
$$;

-- Non-principal ownership, counting pending trades as committed (prevents over-allocation of the float cap).
create or replace function public.committed_public_units()
returns numeric language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_principal text; v_total numeric; v_pu numeric; v_pb numeric; v_ps numeric;
begin
  select principal_name, total_units into v_principal, v_total from public.fund_config where id=1;
  v_pu := public.effective_units(v_principal);
  select coalesce(sum(units),0) into v_pb from public.trades
    where status='pending' and public.norm(buyer_name)=public.norm(v_principal);
  select coalesce(sum(units),0) into v_ps from public.trades
    where status='pending' and public.norm(seller_name)=public.norm(v_principal);
  return coalesce(v_total,0) - (v_pu + v_pb - v_ps);
end; $$;

-- How many more units the Fund may still sell at Alış before hitting the float cap.
create or replace function public.fund_sell_capacity()
returns numeric language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_total numeric; v_cap_pct numeric; v_committed numeric;
begin
  select total_units, float_cap_pct into v_total, v_cap_pct from public.fund_config where id=1;
  if v_total is null or v_total <= 0 then return 0; end if;
  v_committed := public.committed_public_units();
  return greatest(0, v_total * v_cap_pct - v_committed);
end; $$;

-- Caller's own sellable amount (safe wrapper).
create or replace function public.my_available_to_sell()
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select public.available_to_sell(coalesce(
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() -> 'user_metadata' ->> 'name',
    auth.jwt() -> 'user_metadata' ->> 'display_name'))
$$;

-- Aggregated market status for the UI (no per-holder identities).
create or replace function public.market_status()
returns json language sql stable security definer set search_path = public, pg_temp as $$
  select json_build_object(
    'unit_price', c.unit_price,
    'commission', c.commission,
    'satis', round(c.unit_price * (1 - c.commission), 4),
    'alis',  round(c.unit_price * (1 + c.commission), 4),
    'total_units', c.total_units,
    'float_cap_pct', c.float_cap_pct,
    'public_float_pct', case when c.total_units > 0
        then round(public.committed_public_units() / c.total_units, 6) else 0 end,
    'fund_sell_capacity', public.fund_sell_capacity(),
    'is_admin', public.is_fund_admin(),
    'updated_at', c.updated_at
  ) from public.fund_config c where c.id=1
$$;

-- Admin-only sync from the Google Sheet (called by the server with the admin's session).
create or replace function public.sync_fund_state(p_payload jsonb)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count int;
begin
  if not public.is_fund_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.fund_config set
    principal_name = coalesce(p_payload->>'principal_name', principal_name),
    total_units    = coalesce((p_payload->>'total_units')::numeric, total_units),
    unit_price     = coalesce((p_payload->>'unit_price')::numeric, unit_price),
    commission     = coalesce((p_payload->>'commission')::numeric, commission),
    float_cap_pct  = coalesce((p_payload->>'float_cap_pct')::numeric, float_cap_pct),
    updated_at     = now()
  where id = 1;

  if p_payload ? 'opening_balances' then
    insert into public.opening_balances (holder_name, opening_units, synced_at)
    select x.holder_name, x.opening_units, now()
    from jsonb_to_recordset(p_payload->'opening_balances') as x(holder_name text, opening_units numeric)
    where x.holder_name is not null
    on conflict (holder_name) do update
      set opening_units = excluded.opening_units, synced_at = now();
  end if;

  select count(*) into v_count from public.opening_balances;
  return json_build_object('ok', true, 'holders', v_count);
end; $$;

-- ------------------------------------------------------------
-- Privileges: lock down per-holder helpers; expose only safe surface.
-- ------------------------------------------------------------
revoke execute on function public.effective_units(text)        from public, anon, authenticated;
revoke execute on function public.available_to_sell(text)      from public, anon, authenticated;
revoke execute on function public.committed_public_units()     from public, anon, authenticated;
revoke execute on function public.fund_sell_capacity()         from public, anon, authenticated;
revoke execute on function public.sync_fund_state(jsonb)       from public, anon;

grant execute on function public.is_fund_admin()           to authenticated;
grant execute on function public.my_available_to_sell()    to authenticated;
grant execute on function public.market_status()           to authenticated;
grant execute on function public.sync_fund_state(jsonb)    to authenticated;
