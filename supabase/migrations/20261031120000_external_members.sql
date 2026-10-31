-- ============================================================
-- External members: people outside the family who bank with İsmayılBank.
--
-- Until now every auth user was family: one login opened the İRF
-- portfolio, the bank, the bond market and the share market. The first
-- outsider (a groupmate who borrowed) must be able to log in and do the
-- same business — borrow, deposit, buy bonds, buy İRF shares — with two
-- differences:
--
--   1. No family views: no /dashboard (holdings, the shareholder list by
--      name), no bank-wide transparency view (every depositor and borrower
--      by name). Enforced by the app (requireFamilyUser + /bank gating).
--   2. Share purchases are capped: an external holder may own at most
--      fund_config.external_cap_pct of total_units (2% by default; the
--      family-wide float cap of 10% — "İsmayıl keeps 90%" — still applies on
--      top). Enforced HERE, in place_order, so no client can route around it.
--
-- Membership is a server-controlled registry keyed by auth.uid(), the same
-- shape as admin_users: nothing client-writable (user_metadata, JWT claims)
-- takes part. İsmayıl manages it from the /bank cabinet through the two
-- admin-gated RPCs below.
--
-- DRIFT NOTE: place_order is rebuilt from the LIVE production definition
-- (the 2026-05-22 hidden-guard version). The 2026-05-23 price-bounds
-- migration (20260523120000) was never applied to production — its checks
-- are NOT silently re-added here; the OrderTicket enforces them client-side.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Registry + read side.
-- ------------------------------------------------------------
create table if not exists public.external_users (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  note     text,
  added_at timestamptz not null default now()
);

-- Definer functions read it as the table owner; clients never touch it.
alter table public.external_users enable row level security;
revoke all on public.external_users from public, anon, authenticated;

create or replace function public.is_external_user()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.external_users e where e.user_id = auth.uid()
  )
$$;

revoke all on function public.is_external_user() from public, anon;
grant execute on function public.is_external_user() to authenticated;

-- ------------------------------------------------------------
-- 2. Admin side: the cabinet's "Giriş hüquqları" panel.
--
-- Lists every auth user (id, e-mail, display name, flags) so İsmayıl can
-- see who exists and flip the switch without the Supabase dashboard or
-- SQL. Admins can never be marked external (that would lock the cabinet
-- away), and nobody can flip their own row.
-- ------------------------------------------------------------
create or replace function public.admin_list_app_users()
returns table (
  user_id         uuid,
  email           text,
  display_name    text,
  is_admin        boolean,
  external        boolean,
  created_at      timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_fund_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select u.id,
         u.email::text,
         nullif(btrim(coalesce(
           u.raw_user_meta_data ->> 'full_name',
           u.raw_user_meta_data ->> 'name',
           u.raw_user_meta_data ->> 'display_name', '')), '') as display_name,
         (a.user_id is not null) as is_admin,
         (e.user_id is not null) as external,
         u.created_at,
         u.last_sign_in_at
    from auth.users u
    left join public.admin_users    a on a.user_id = u.id
    left join public.external_users e on e.user_id = u.id
   order by u.created_at;
end;
$$;

revoke all on function public.admin_list_app_users() from public, anon;
grant execute on function public.admin_list_app_users() to authenticated;

create or replace function public.admin_set_external(
  p_user_id  uuid,
  p_external boolean
)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_fund_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_user_id is null or p_external is null then
    raise exception 'Yanlış sorğu';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Öz girişinizi dəyişə bilməzsiniz';
  end if;
  if exists (select 1 from public.admin_users a where a.user_id = p_user_id) then
    raise exception 'Admin girişi kənar üzv ola bilməz';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'İstifadəçi tapılmadı';
  end if;

  if p_external then
    insert into public.external_users (user_id, note)
    values (p_user_id, 'set from the /bank cabinet')
    on conflict (user_id) do nothing;
  else
    delete from public.external_users where user_id = p_user_id;
  end if;

  return p_external;
end;
$$;

revoke all on function public.admin_set_external(uuid, boolean) from public, anon;
grant execute on function public.admin_set_external(uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- 3. The share cap for external holders.
-- ------------------------------------------------------------
alter table public.fund_config
  add column if not exists external_cap_pct numeric not null default 0.02;

-- Everything a holder has or is about to have: settled units, pending
-- trades in both directions, and his own still-open buy orders — so stacked
-- orders cannot step past the cap one at a time.
create or replace function public.holder_committed_units(p_holder text)
returns numeric
language sql stable security definer set search_path = public, pg_temp as $$
  select
    public.effective_units(p_holder)
    + coalesce((select sum(t.units) from public.trades t
                where t.status = 'pending' and public.norm(t.buyer_name) = public.norm(p_holder)), 0)
    - coalesce((select sum(t.units) from public.trades t
                where t.status = 'pending' and public.norm(t.seller_name) = public.norm(p_holder)), 0)
    + coalesce((select sum(o.remaining_units) from public.orders o
                where o.side = 'buy' and o.status in ('open','partial') and o.hidden = false
                  and public.norm(o.holder_name) = public.norm(p_holder)), 0)
$$;

revoke all on function public.holder_committed_units(text) from public, anon, authenticated;

-- How many more units the CALLER may still buy: null for family (no cap),
-- otherwise external_cap_pct × total_units minus what he already has.
create or replace function public.my_external_buy_capacity()
returns numeric
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_holder text;
  v_total  numeric;
  v_pct    numeric;
begin
  if not public.is_external_user() then
    return null;
  end if;
  v_holder := coalesce(
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() -> 'user_metadata' ->> 'name',
    auth.jwt() -> 'user_metadata' ->> 'display_name');
  select total_units, external_cap_pct into v_total, v_pct
    from public.fund_config where id = 1;
  if v_holder is null or v_total is null or v_total <= 0 then
    return 0;
  end if;
  return greatest(0, v_total * v_pct - public.holder_committed_units(v_holder));
end;
$$;

revoke all on function public.my_external_buy_capacity() from public, anon;
grant execute on function public.my_external_buy_capacity() to authenticated;

-- market_status: the ticket needs to know the caller's cap to explain it.
create or replace function public.market_status()
returns json
language sql stable security definer set search_path = public, pg_temp as $$
  select json_build_object(
    'unit_price', c.unit_price,
    'commission', c.commission,
    'satis', round(c.unit_price * (1 - c.commission), 4),
    'alis',  round(c.unit_price * (1 + c.commission), 4),
    'best_buy_order', (
      select max(price) from public.orders
       where side = 'buy' and status in ('open','partial')
         and remaining_units > 0 and hidden = false
    ),
    'best_sell_order', (
      select min(price) from public.orders
       where side = 'sell' and status in ('open','partial')
         and remaining_units > 0 and hidden = false
    ),
    'total_units', c.total_units,
    'float_cap_pct', c.float_cap_pct,
    'public_float_pct', case when c.total_units > 0
        then round(public.committed_public_units() / c.total_units, 6) else 0 end,
    'fund_sell_capacity', public.fund_sell_capacity(),
    'is_admin', public.is_fund_admin(),
    'is_external', public.is_external_user(),
    'external_cap_pct', c.external_cap_pct,
    'external_buy_capacity', public.my_external_buy_capacity(),
    'updated_at', c.updated_at
  ) from public.fund_config c where c.id=1
$$;

-- place_order: LIVE definition + the external cap check on the buy side.
-- The whole order is refused (not trimmed) so the holder sees one clear
-- message instead of a silently smaller fill.
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
  v_ext_cap      numeric;
  v_ext_pct      numeric;
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

  select principal_name, unit_price, commission, external_cap_pct
    into v_principal, v_unit_price, v_commission, v_ext_pct
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
  else
    -- External members: total exposure (held + pending + open buys + this
    -- order) may not exceed external_cap_pct of the fund.
    v_ext_cap := public.my_external_buy_capacity();
    if v_ext_cap is not null and p_units > v_ext_cap then
      raise exception '%', format(
        'Kənar üzv limiti: ümumi payların %s%%-i. Ala biləcəyiniz maksimum: %s pay',
        round(v_ext_pct * 100, 2), round(v_ext_cap, 6));
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
