-- ============================================================
-- Fix: deleted (hidden) orders could be resurrected and executed.
--
-- Root cause: delete_order only sets hidden=true on a terminal order, but
-- reject_trade reopened orders with `status in ('open','partial','filled')`
-- WITHOUT excluding hidden ones. Rejecting a pending trade therefore flipped a
-- deleted order back to 'open' (units restored) while it stayed hidden — so it
-- vanished from the owner's list (getMarketData filters hidden=false) yet was
-- still live in order_book()/place_order and could match. Result: "hidden"
-- orders executing after the user cancelled + deleted them.
--
-- Fix: treat hidden as a hard "not live" flag everywhere an order is considered
-- live — reject_trade reopen, the place_order match loops, and the
-- available_to_sell reservation — and neutralize any already-resurrected rows.
-- (order_book() already filters hidden in prod, so it is left unchanged here.)
-- ============================================================

-- 1) place_order: never match against a hidden order (defense-in-depth).
create or replace function public.place_order(p_side text, p_units numeric, p_price numeric)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid          uuid := auth.uid();
  v_holder       text;
  v_principal    text;
  v_unit_price   numeric;
  v_commission   numeric;
  v_satis        numeric;
  v_alis         numeric;
  v_order_id     uuid;
  v_remaining    numeric;
  v_avail        numeric;
  v_fill         numeric;
  v_cap          numeric;
  v_is_principal boolean;
  v_fills        jsonb := '[]'::jsonb;
  r              record;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='42501'; end if;
  v_holder := coalesce(
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() -> 'user_metadata' ->> 'name',
    auth.jwt() -> 'user_metadata' ->> 'display_name');
  if v_holder is null or btrim(v_holder) = '' then raise exception 'no holder name on account'; end if;
  if p_side not in ('buy','sell') then raise exception 'invalid side'; end if;
  if p_units is null or p_units <= 0 then raise exception 'units must be positive'; end if;
  if p_price is null or p_price <= 0 then raise exception 'price must be positive'; end if;

  select principal_name, unit_price, commission
    into v_principal, v_unit_price, v_commission
  from public.fund_config where id = 1;
  if v_unit_price is null or v_unit_price <= 0 then
    raise exception 'fund not configured yet (admin sync required)';
  end if;
  v_satis := round(v_unit_price * (1 - v_commission), 4);
  v_alis  := round(v_unit_price * (1 + v_commission), 4);
  v_is_principal := public.norm(v_holder) = public.norm(v_principal);

  if p_side = 'sell' then
    if p_price < v_satis then
      raise exception 'sell price %.4f is below the Satış floor %.4f', p_price, v_satis;
    end if;
    v_avail := public.available_to_sell(v_holder);
    if p_units > v_avail then
      raise exception 'insufficient sellable units: requested %, available %', p_units, v_avail;
    end if;
  end if;

  insert into public.orders (user_id, holder_name, side, units, remaining_units, price, status)
  values (v_uid, v_holder, p_side, p_units, p_units, p_price, 'open')
  returning id into v_order_id;
  v_remaining := p_units;

  if p_side = 'sell' then
    for r in
      select * from public.orders
      where side='buy' and status in ('open','partial') and remaining_units > 0
        and hidden = false
        and price >= p_price and user_id <> v_uid
      order by price desc, created_at asc
      for update
    loop
      exit when v_remaining <= 0;
      v_fill := least(v_remaining, r.remaining_units);
      insert into public.trades(buy_order_id, sell_order_id, buyer_user_id, seller_user_id,
        buyer_name, seller_name, units, price, counterparty_kind, status)
      values (r.id, v_order_id, r.user_id, v_uid, r.holder_name, v_holder, v_fill, r.price, 'p2p', 'pending');
      update public.orders set remaining_units = remaining_units - v_fill,
        status = case when remaining_units - v_fill <= 0 then 'filled' else 'partial' end
      where id = r.id;
      v_remaining := v_remaining - v_fill;
      v_fills := v_fills || jsonb_build_object('kind','p2p','units',v_fill,'price',r.price,'counterparty',r.holder_name);
    end loop;

    if v_remaining > 0 and p_price <= v_satis and not v_is_principal then
      insert into public.trades(buy_order_id, sell_order_id, buyer_user_id, seller_user_id,
        buyer_name, seller_name, units, price, counterparty_kind, status)
      values (null, v_order_id, null, v_uid, v_principal, v_holder, v_remaining, v_satis, 'fund_buy', 'pending');
      v_fills := v_fills || jsonb_build_object('kind','fund_buy','units',v_remaining,'price',v_satis,'counterparty',v_principal);
      v_remaining := 0;
    end if;

  else -- buy
    for r in
      select * from public.orders
      where side='sell' and status in ('open','partial') and remaining_units > 0
        and hidden = false
        and price <= p_price and user_id <> v_uid
      order by price asc, created_at asc
      for update
    loop
      exit when v_remaining <= 0;
      v_fill := least(v_remaining, r.remaining_units);
      insert into public.trades(buy_order_id, sell_order_id, buyer_user_id, seller_user_id,
        buyer_name, seller_name, units, price, counterparty_kind, status)
      values (v_order_id, r.id, v_uid, r.user_id, v_holder, r.holder_name, v_fill, r.price, 'p2p', 'pending');
      update public.orders set remaining_units = remaining_units - v_fill,
        status = case when remaining_units - v_fill <= 0 then 'filled' else 'partial' end
      where id = r.id;
      v_remaining := v_remaining - v_fill;
      v_fills := v_fills || jsonb_build_object('kind','p2p','units',v_fill,'price',r.price,'counterparty',r.holder_name);
    end loop;

    if v_remaining > 0 and p_price >= v_alis and not v_is_principal then
      v_cap := public.fund_sell_capacity();
      if v_cap > 0 then
        v_fill := least(v_remaining, v_cap);
        insert into public.trades(buy_order_id, sell_order_id, buyer_user_id, seller_user_id,
          buyer_name, seller_name, units, price, counterparty_kind, status)
        values (v_order_id, null, v_uid, null, v_holder, v_principal, v_fill, v_alis, 'fund_sell', 'pending');
        v_fills := v_fills || jsonb_build_object('kind','fund_sell','units',v_fill,'price',v_alis,'counterparty',v_principal);
        v_remaining := v_remaining - v_fill;
      end if;
    end if;
  end if;

  update public.orders set remaining_units = v_remaining,
    status = case when v_remaining <= 0 then 'filled'
                  when v_remaining < units then 'partial'
                  else 'open' end
  where id = v_order_id;

  return json_build_object('order_id', v_order_id, 'remaining', v_remaining,
    'fills', v_fills, 'satis', v_satis, 'alis', v_alis);
end; $$;

-- 2) reject_trade: do NOT resurrect a deleted (hidden) order (the root cause).
create or replace function public.reject_trade(p_trade_id uuid)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); t record;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='42501'; end if;
  select * into t from public.trades where id = p_trade_id for update;
  if not found then raise exception 'trade not found'; end if;
  if not (public.is_fund_admin() or t.buyer_user_id = v_uid or t.seller_user_id = v_uid) then
    raise exception 'not authorized' using errcode='42501';
  end if;
  if t.status <> 'pending' then raise exception 'trade is not pending (status %)', t.status; end if;

  update public.trades set status='cancelled' where id = p_trade_id;

  -- Return the unsettled units to the originating orders, unless that order was
  -- cancelled or deleted (hidden) by its owner — those must stay terminal.
  if t.buy_order_id is not null then
    update public.orders set remaining_units = remaining_units + t.units,
      status = case when remaining_units + t.units >= units then 'open' else 'partial' end
    where id = t.buy_order_id and status in ('open','partial','filled') and hidden = false;
  end if;
  if t.sell_order_id is not null then
    update public.orders set remaining_units = remaining_units + t.units,
      status = case when remaining_units + t.units >= units then 'open' else 'partial' end
    where id = t.sell_order_id and status in ('open','partial','filled') and hidden = false;
  end if;

  return json_build_object('ok', true);
end; $$;

-- 3) available_to_sell: a hidden order reserves nothing.
create or replace function public.available_to_sell(p_holder text)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select
    public.effective_units(p_holder)
    - coalesce((select sum(o.remaining_units) from public.orders o
                where o.side='sell' and o.status in ('open','partial') and o.hidden = false
                  and public.norm(o.holder_name) = public.norm(p_holder)), 0)
    - coalesce((select sum(t.units) from public.trades t
                where t.status='pending' and public.norm(t.seller_name) = public.norm(p_holder)), 0)
$$;

-- 4) One-time cleanup: neutralize any already-resurrected hidden orders.
update public.orders set status = 'cancelled', remaining_units = 0
where hidden = true and status in ('open','partial');
