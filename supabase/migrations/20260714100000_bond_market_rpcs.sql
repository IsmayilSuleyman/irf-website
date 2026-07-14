-- ============================================================
-- Bond market RPCs: holdings helpers, place/cancel/delete order,
-- settlement, status/book reads, and İsmayıl's issuance + payment
-- recording. All SECURITY DEFINER; authorization inside the RPCs
-- (session-name / is_fund_admin), mirroring the share market.
-- ============================================================

-- ------------------------------------------------------------
-- Holdings helpers (internal — revoked from clients).
-- ------------------------------------------------------------

-- Settled net holdings in one series. There are no opening balances:
-- everyone starts at 0 and accumulates via settled trades. Primary sales
-- come out of the series' unissued inventory, not out of the issuer's
-- personal holdings, so they are excluded from the seller-side sum.
create or replace function public.bond_effective_units(p_series uuid, p_holder text)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select
    coalesce((select sum(t.units) from public.bond_trades t
              where t.series_id = p_series and t.status = 'settled'
                and public.norm(t.buyer_name) = public.norm(p_holder)), 0)::int
    - coalesce((select sum(t.units) from public.bond_trades t
                where t.series_id = p_series and t.status = 'settled'
                  and t.counterparty_kind = 'p2p'
                  and public.norm(t.seller_name) = public.norm(p_holder)), 0)::int
$$;

-- Sellable now = settled units - units locked in live sell orders
-- - units in pending p2p sell trades. hidden=false everywhere a row is
-- treated as live (see the market hidden-guard migration).
create or replace function public.bond_available_to_sell(p_series uuid, p_holder text)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select
    public.bond_effective_units(p_series, p_holder)
    - coalesce((select sum(o.remaining_units) from public.bond_orders o
                where o.series_id = p_series and o.side = 'sell'
                  and o.status in ('open','partial') and o.hidden = false
                  and public.norm(o.holder_name) = public.norm(p_holder)), 0)::int
    - coalesce((select sum(t.units) from public.bond_trades t
                where t.series_id = p_series and t.status = 'pending'
                  and t.counterparty_kind = 'p2p'
                  and public.norm(t.seller_name) = public.norm(p_holder)), 0)::int
$$;

-- Unissued primary inventory. Pending primary trades reserve inventory;
-- rejected ones (status 'cancelled') release it automatically.
create or replace function public.bond_primary_available(p_series uuid)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select greatest(
    coalesce((select s.total_units from public.bond_series s where s.id = p_series), 0)
    - coalesce((select sum(t.units) from public.bond_trades t
                where t.series_id = p_series and t.counterparty_kind = 'primary'
                  and t.status in ('pending','settled')), 0), 0)::int
$$;

-- ------------------------------------------------------------
-- place_bond_order: validate, insert, auto-match (P2P price-time
-- priority at the resting order's price, then the bank's primary
-- issue at issue_price while unissued inventory remains).
-- All fills are 'pending' until İsmayıl confirms settlement.
-- ------------------------------------------------------------
create or replace function public.place_bond_order(
  p_series_id uuid, p_side text, p_units numeric, p_price numeric)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid          uuid := auth.uid();
  v_holder       text;
  v_principal    text;
  v_is_principal boolean;
  s              record;
  v_min_price    numeric;
  v_max_price    numeric;
  v_units        int;
  v_order_id     uuid;
  v_remaining    int;
  v_avail        int;
  v_fill         int;
  v_cap          int;
  v_fills        jsonb := '[]'::jsonb;
  r              record;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='42501'; end if;
  v_holder := coalesce(
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() -> 'user_metadata' ->> 'name',
    auth.jwt() -> 'user_metadata' ->> 'display_name');
  if v_holder is null or btrim(v_holder) = '' then
    raise exception 'Hesabınızda ad göstərilməyib';
  end if;
  if p_side not in ('buy','sell') then raise exception 'Yanlış tərəf'; end if;
  if p_units is null or p_units <= 0 or p_units <> trunc(p_units) then
    raise exception 'İstiqraz sayı müsbət tam ədəd olmalıdır';
  end if;
  v_units := p_units::int;
  if p_price is null or p_price <= 0 then
    raise exception 'Qiymət müsbət olmalıdır';
  end if;

  -- Lock the series row: serializes primary-inventory math per series.
  select * into s from public.bond_series where id = p_series_id for update;
  if not found then raise exception 'İstiqraz seriyası tapılmadı'; end if;
  if s.status <> 'active' then
    raise exception 'Bu istiqraz seriyası aktiv deyil (status: %)', s.status;
  end if;
  if current_date >= s.maturity_date then
    raise exception 'İstiqrazın ödəmə tarixi çatıb — ticarət bağlıdır';
  end if;

  -- Sanity price bounds around the face value.
  v_min_price := round(s.face_value_azn * 0.1, 2);
  v_max_price := round(s.face_value_azn * 2, 2);
  if p_price < v_min_price or p_price > v_max_price then
    raise exception 'Qiymət % ₼ ilə % ₼ arasında olmalıdır', v_min_price, v_max_price;
  end if;

  select principal_name into v_principal from public.fund_config where id = 1;
  v_principal := coalesce(nullif(btrim(v_principal), ''), 'İSMAYIL SÜLEYMAN');
  v_is_principal := public.norm(v_holder) = public.norm(v_principal);

  if p_side = 'sell' then
    v_avail := public.bond_available_to_sell(p_series_id, v_holder);
    if v_units > v_avail then
      raise exception 'Satıla bilən istiqraz çatışmır: istənilən %, mövcud %', v_units, v_avail;
    end if;
  end if;

  insert into public.bond_orders (series_id, user_id, holder_name, side, units, remaining_units, price, status)
  values (p_series_id, v_uid, v_holder, p_side, v_units, v_units, p_price, 'open')
  returning id into v_order_id;
  v_remaining := v_units;

  if p_side = 'sell' then
    for r in
      select * from public.bond_orders
      where series_id = p_series_id and side = 'buy'
        and status in ('open','partial') and remaining_units > 0
        and hidden = false
        and price >= p_price and user_id <> v_uid
      order by price desc, created_at asc
      for update
    loop
      exit when v_remaining <= 0;
      v_fill := least(v_remaining, r.remaining_units);
      insert into public.bond_trades(series_id, buy_order_id, sell_order_id, buyer_user_id, seller_user_id,
        buyer_name, seller_name, units, price, counterparty_kind, status)
      values (p_series_id, r.id, v_order_id, r.user_id, v_uid, r.holder_name, v_holder, v_fill, r.price, 'p2p', 'pending');
      update public.bond_orders set remaining_units = remaining_units - v_fill,
        status = case when remaining_units - v_fill <= 0 then 'filled' else 'partial' end
      where id = r.id;
      v_remaining := v_remaining - v_fill;
      v_fills := v_fills || jsonb_build_object('kind','p2p','units',v_fill,'price',r.price,'counterparty',r.holder_name);
    end loop;

  else -- buy
    for r in
      select * from public.bond_orders
      where series_id = p_series_id and side = 'sell'
        and status in ('open','partial') and remaining_units > 0
        and hidden = false
        and price <= p_price and user_id <> v_uid
      order by price asc, created_at asc
      for update
    loop
      exit when v_remaining <= 0;
      v_fill := least(v_remaining, r.remaining_units);
      insert into public.bond_trades(series_id, buy_order_id, sell_order_id, buyer_user_id, seller_user_id,
        buyer_name, seller_name, units, price, counterparty_kind, status)
      values (p_series_id, v_order_id, r.id, v_uid, r.user_id, v_holder, r.holder_name, v_fill, r.price, 'p2p', 'pending');
      update public.bond_orders set remaining_units = remaining_units - v_fill,
        status = case when remaining_units - v_fill <= 0 then 'filled' else 'partial' end
      where id = r.id;
      v_remaining := v_remaining - v_fill;
      v_fills := v_fills || jsonb_build_object('kind','p2p','units',v_fill,'price',r.price,'counterparty',r.holder_name);
    end loop;

    -- Primary issue: the bank sells unissued inventory at issue_price.
    -- The principal is excluded (he'd be buying from himself).
    if v_remaining > 0 and p_price >= s.issue_price_azn and not v_is_principal then
      v_cap := public.bond_primary_available(p_series_id);
      if v_cap > 0 then
        v_fill := least(v_remaining, v_cap);
        insert into public.bond_trades(series_id, buy_order_id, sell_order_id, buyer_user_id, seller_user_id,
          buyer_name, seller_name, units, price, counterparty_kind, status)
        values (p_series_id, v_order_id, null, v_uid, null, v_holder, v_principal, v_fill, s.issue_price_azn, 'primary', 'pending');
        v_fills := v_fills || jsonb_build_object('kind','primary','units',v_fill,'price',s.issue_price_azn,'counterparty',s.name);
        v_remaining := v_remaining - v_fill;
      end if;
    end if;
  end if;

  update public.bond_orders set remaining_units = v_remaining,
    status = case when v_remaining <= 0 then 'filled'
                  when v_remaining < units then 'partial'
                  else 'open' end
  where id = v_order_id;

  return json_build_object('order_id', v_order_id, 'remaining', v_remaining, 'fills', v_fills);
end; $$;

-- Cancel an open/partial order (owner or admin); frees the reservation.
create or replace function public.cancel_bond_order(p_order_id uuid)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); r record;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='42501'; end if;
  select * into r from public.bond_orders where id = p_order_id for update;
  if not found then raise exception 'Sifariş tapılmadı'; end if;
  if r.user_id <> v_uid and not public.is_fund_admin() then
    raise exception 'not your order' using errcode='42501';
  end if;
  if r.status not in ('open','partial') then
    raise exception 'Sifariş ləğv edilə bilməz (status: %)', r.status;
  end if;
  update public.bond_orders set status='cancelled', remaining_units=0 where id = p_order_id;
  return json_build_object('ok', true);
end; $$;

-- Soft-delete a terminal order from the owner's list (trades reference it).
create or replace function public.delete_bond_order(p_order_id uuid)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); r record;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='42501'; end if;
  select * into r from public.bond_orders where id = p_order_id for update;
  if not found then raise exception 'Sifariş tapılmadı'; end if;
  if r.user_id <> v_uid and not public.is_fund_admin() then
    raise exception 'not your order' using errcode='42501';
  end if;
  if r.status not in ('filled','cancelled') then
    raise exception 'Yalnız tamamlanmış və ya ləğv edilmiş sifariş silinə bilər (status: %)', r.status;
  end if;
  update public.bond_orders set hidden = true where id = p_order_id;
  return json_build_object('ok', true);
end; $$;

-- ------------------------------------------------------------
-- Settlement (mirrors confirm_trade / reject_trade + hidden guard).
-- ------------------------------------------------------------
create or replace function public.confirm_bond_trade(p_trade_id uuid)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare t record;
begin
  if not public.is_fund_admin() then raise exception 'not authorized' using errcode='42501'; end if;
  select * into t from public.bond_trades where id = p_trade_id for update;
  if not found then raise exception 'Əqd tapılmadı'; end if;
  if t.status <> 'pending' then raise exception 'Əqd gözləmədə deyil (status: %)', t.status; end if;
  update public.bond_trades set status='settled', settled_at=now(), confirmed_by=auth.uid()
  where id = p_trade_id;
  return json_build_object('ok', true);
end; $$;

create or replace function public.reject_bond_trade(p_trade_id uuid)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); t record;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='42501'; end if;
  select * into t from public.bond_trades where id = p_trade_id for update;
  if not found then raise exception 'Əqd tapılmadı'; end if;
  if not (public.is_fund_admin() or t.buyer_user_id = v_uid or t.seller_user_id = v_uid) then
    raise exception 'not authorized' using errcode='42501';
  end if;
  if t.status <> 'pending' then raise exception 'Əqd gözləmədə deyil (status: %)', t.status; end if;

  update public.bond_trades set status='cancelled' where id = p_trade_id;

  -- Return the units to the live originating orders (never hidden ones).
  if t.buy_order_id is not null then
    update public.bond_orders set remaining_units = remaining_units + t.units,
      status = case when remaining_units + t.units >= units then 'open' else 'partial' end
    where id = t.buy_order_id and status in ('open','partial','filled') and hidden = false;
  end if;
  if t.sell_order_id is not null then
    update public.bond_orders set remaining_units = remaining_units + t.units,
      status = case when remaining_units + t.units >= units then 'open' else 'partial' end
    where id = t.sell_order_id and status in ('open','partial','filled') and hidden = false;
  end if;

  return json_build_object('ok', true);
end; $$;

-- ------------------------------------------------------------
-- Reads for the UI.
-- ------------------------------------------------------------

-- Per-order book rows for one series (names visible to signed-in users,
-- same trust model as the share market's order_book()).
create or replace function public.bond_order_book(p_series_id uuid)
returns table(side text, price numeric, units int, holder_name text)
language sql stable security definer set search_path = public, pg_temp as $$
  select o.side, o.price, o.remaining_units as units, o.holder_name
  from public.bond_orders o
  where o.series_id = p_series_id
    and o.status in ('open','partial') and o.remaining_units > 0
    and o.hidden = false
  order by case when o.side = 'buy' then 0 else 1 end, o.price desc, o.created_at
$$;

-- Whole bond-market snapshot: every series with primary inventory,
-- best bid/ask, the caller's own position and the next coupon date.
create or replace function public.bond_market_status()
returns json
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_holder text := coalesce(
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() -> 'user_metadata' ->> 'name',
    auth.jwt() -> 'user_metadata' ->> 'display_name');
  v_series jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'face_value_azn', s.face_value_azn,
      'coupon_rate_pct', s.coupon_rate_pct,
      'coupon_period_months', s.coupon_period_months,
      'issue_price_azn', s.issue_price_azn,
      'total_units', s.total_units,
      'issue_date', s.issue_date,
      'maturity_date', s.maturity_date,
      'status', s.status,
      'primary_sold', pa.sold,
      'primary_available', greatest(s.total_units - pa.sold, 0),
      'next_coupon_date', nc.next_coupon_date,
      'best_bid', bb.p,
      'best_ask', ba.p,
      'my_units', public.bond_effective_units(s.id, v_holder),
      'my_available', public.bond_available_to_sell(s.id, v_holder)
    ) order by s.created_at desc), '[]'::jsonb)
  into v_series
  from public.bond_series s
  cross join lateral (
    select coalesce(sum(t.units), 0)::int as sold
    from public.bond_trades t
    where t.series_id = s.id and t.counterparty_kind = 'primary'
      and t.status in ('pending','settled')
  ) pa
  cross join lateral (
    select min((s.issue_date + make_interval(months => g.g * s.coupon_period_months))::date) as next_coupon_date
    from generate_series(1, 240) as g(g)
    where (s.issue_date + make_interval(months => g.g * s.coupon_period_months))::date > current_date
      and (s.issue_date + make_interval(months => g.g * s.coupon_period_months))::date <= s.maturity_date
  ) nc
  cross join lateral (
    select max(o.price) as p from public.bond_orders o
    where o.series_id = s.id and o.side = 'buy'
      and o.status in ('open','partial') and o.remaining_units > 0 and o.hidden = false
  ) bb
  cross join lateral (
    select min(o.price) as p from public.bond_orders o
    where o.series_id = s.id and o.side = 'sell'
      and o.status in ('open','partial') and o.remaining_units > 0 and o.hidden = false
  ) ba;

  return json_build_object('is_admin', public.is_fund_admin(), 'series', v_series);
end; $$;

-- ------------------------------------------------------------
-- İsmayıl's issuance + lifecycle.
-- ------------------------------------------------------------
create or replace function public.admin_issue_bond_series(
  p_name text,
  p_face_value numeric,
  p_coupon_rate_pct numeric,
  p_coupon_period_months int,
  p_term_months int,
  p_issue_price numeric,
  p_total_units numeric)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_maturity date;
begin
  if not public.is_fund_admin() then raise exception 'not authorized' using errcode='42501'; end if;
  if p_name is null or btrim(p_name) = '' then raise exception 'Seriya adı tələb olunur'; end if;
  if p_face_value is null or p_face_value <= 0 then raise exception 'Nominal dəyər müsbət olmalıdır'; end if;
  if p_coupon_rate_pct is null or p_coupon_rate_pct < 0 or p_coupon_rate_pct > 100 then
    raise exception 'Kupon faizi 0 ilə 100 arasında olmalıdır';
  end if;
  if p_term_months is null or p_term_months <= 0 or p_term_months > 240 then
    raise exception 'Müddət 1 ilə 240 ay arasında olmalıdır';
  end if;
  if p_coupon_period_months is null or p_coupon_period_months <= 0
     or p_coupon_period_months > p_term_months
     or p_term_months % p_coupon_period_months <> 0 then
    raise exception 'Kupon dövrü müddəti tam bölməlidir (müddət % ay)', p_term_months;
  end if;
  if p_issue_price is null or p_issue_price < round(p_face_value * 0.1, 2)
     or p_issue_price > round(p_face_value * 2, 2) then
    raise exception 'Buraxılış qiyməti nominalın 10%% ilə 200%%-i arasında olmalıdır';
  end if;
  if p_total_units is null or p_total_units < 1 or p_total_units <> trunc(p_total_units) then
    raise exception 'İstiqraz sayı müsbət tam ədəd olmalıdır';
  end if;

  v_maturity := (current_date + make_interval(months => p_term_months))::date;

  insert into public.bond_series
    (name, face_value_azn, coupon_rate_pct, coupon_period_months,
     issue_price_azn, total_units, issue_date, maturity_date, created_by)
  values
    (btrim(p_name), p_face_value, p_coupon_rate_pct, p_coupon_period_months,
     p_issue_price, p_total_units::int, current_date, v_maturity, auth.uid())
  returning id into v_id;

  return json_build_object('ok', true, 'series_id', v_id, 'maturity_date', v_maturity);
end; $$;

-- Cancel a series that never traded (typo, wrong terms).
create or replace function public.admin_cancel_bond_series(p_series_id uuid)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare s record; v_trades int;
begin
  if not public.is_fund_admin() then raise exception 'not authorized' using errcode='42501'; end if;
  select * into s from public.bond_series where id = p_series_id for update;
  if not found then raise exception 'Seriya tapılmadı'; end if;
  if s.status <> 'active' then raise exception 'Seriya aktiv deyil (status: %)', s.status; end if;
  select count(*) into v_trades from public.bond_trades
  where series_id = p_series_id and status in ('pending','settled');
  if v_trades > 0 then
    raise exception 'Əqdləri olan seriya ləğv edilə bilməz (% əqd)', v_trades;
  end if;
  update public.bond_orders set status='cancelled', remaining_units=0
  where series_id = p_series_id and status in ('open','partial');
  update public.bond_series set status='cancelled' where id = p_series_id;
  return json_build_object('ok', true);
end; $$;

-- ------------------------------------------------------------
-- Payment recording: İsmayıl pays coupons / principal off-platform,
-- then records it here. Snapshots current settled holders, writes the
-- ledger idempotently, notifies each holder in-app, and returns push
-- subscriptions for the web-push fan-out (route-side).
-- ------------------------------------------------------------
create or replace function public.record_bond_payment(
  p_series_id uuid, p_kind text, p_due_date date)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s           record;
  h           record;
  v_user      uuid;
  v_amount    numeric;
  v_total     numeric := 0;
  v_count     int := 0;
  v_unread    int;
  v_subs      jsonb;
  v_recipients jsonb := '[]'::jsonb;
  v_title     text;
  v_body      text;
begin
  if not public.is_fund_admin() then raise exception 'not authorized' using errcode='42501'; end if;
  if p_kind not in ('coupon','principal') then raise exception 'Yanlış ödəniş növü'; end if;
  if p_due_date is null then raise exception 'Ödəniş tarixi tələb olunur'; end if;

  select * into s from public.bond_series where id = p_series_id for update;
  if not found then raise exception 'Seriya tapılmadı'; end if;

  for h in
    select t.buyer_name as holder_name,
           public.bond_effective_units(p_series_id, t.buyer_name) as units
    from (select distinct buyer_name from public.bond_trades
          where series_id = p_series_id and status = 'settled') t
  loop
    if h.units is null or h.units <= 0 then continue; end if;

    if p_kind = 'coupon' then
      v_amount := round(h.units * s.face_value_azn * (s.coupon_rate_pct / 100.0)
                        * (s.coupon_period_months / 12.0), 2);
    else
      v_amount := round(h.units * s.face_value_azn, 2);
    end if;

    -- Idempotent: the unique index skips holders already recorded for this due date.
    insert into public.bond_payments
      (series_id, payment_kind, due_date, holder_name, user_id, units, amount_azn, recorded_by)
    select p_series_id, p_kind, p_due_date, h.holder_name,
           (select u.id from auth.users u
            where public.norm(coalesce(
              u.raw_user_meta_data->>'full_name',
              u.raw_user_meta_data->>'name',
              u.raw_user_meta_data->>'display_name', '')) = public.norm(h.holder_name)
            order by u.created_at limit 1),
           h.units, v_amount, auth.uid()
    on conflict (series_id, payment_kind, due_date, public.norm(holder_name)) do nothing
    returning user_id into v_user;

    if not found then continue; end if; -- already recorded earlier

    v_count := v_count + 1;
    v_total := v_total + v_amount;

    if v_user is not null then
      if p_kind = 'coupon' then
        v_title := 'Kupon ödənişi';
        v_body  := format('%s: %s istiqraz üzrə %s ₼ kupon ödənişiniz edildi.',
                          s.name, h.units, to_char(v_amount, 'FM999999990.00'));
      else
        v_title := 'İstiqraz ödənişi';
        v_body  := format('%s: %s istiqrazın nominal dəyəri (%s ₼) ödənildi.',
                          s.name, h.units, to_char(v_amount, 'FM999999990.00'));
      end if;

      insert into public.notifications (user_id, kind, title, body)
      values (v_user, 'announcement', v_title, v_body);

      select count(*) into v_unread from public.notifications
      where user_id = v_user and read = false and created_at >= now() - interval '3 days';

      select coalesce(jsonb_agg(jsonb_build_object(
        'endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth)), '[]'::jsonb)
      into v_subs
      from public.push_subscriptions ps where ps.user_id = v_user;

      v_recipients := v_recipients || jsonb_build_object(
        'holder_name', h.holder_name, 'user_id', v_user, 'units', h.units,
        'amount_azn', v_amount, 'title', v_title, 'body', v_body,
        'unread', v_unread, 'subs', v_subs);
    end if;
  end loop;

  -- Recording the principal repayment retires the series.
  if p_kind = 'principal' then
    update public.bond_series set status = 'matured' where id = p_series_id;
  end if;

  return json_build_object('ok', true, 'series', s.name, 'kind', p_kind,
    'due_date', p_due_date, 'count', v_count, 'total_azn', v_total,
    'recipients', v_recipients);
end; $$;

-- ------------------------------------------------------------
-- Privileges.
-- ------------------------------------------------------------
revoke execute on function public.bond_effective_units(uuid, text)   from public, anon, authenticated;
revoke execute on function public.bond_available_to_sell(uuid, text) from public, anon, authenticated;
revoke execute on function public.bond_primary_available(uuid)       from public, anon, authenticated;

revoke execute on function public.place_bond_order(uuid, text, numeric, numeric) from public, anon;
revoke execute on function public.cancel_bond_order(uuid)  from public, anon;
revoke execute on function public.delete_bond_order(uuid)  from public, anon;
revoke execute on function public.confirm_bond_trade(uuid) from public, anon;
revoke execute on function public.reject_bond_trade(uuid)  from public, anon;
revoke execute on function public.bond_order_book(uuid)    from public, anon;
revoke execute on function public.bond_market_status()     from public, anon;
revoke execute on function public.admin_issue_bond_series(text, numeric, numeric, int, int, numeric, numeric) from public, anon;
revoke execute on function public.admin_cancel_bond_series(uuid) from public, anon;
revoke execute on function public.record_bond_payment(uuid, text, date) from public, anon;

grant execute on function public.place_bond_order(uuid, text, numeric, numeric) to authenticated;
grant execute on function public.cancel_bond_order(uuid)  to authenticated;
grant execute on function public.delete_bond_order(uuid)  to authenticated;
grant execute on function public.confirm_bond_trade(uuid) to authenticated;
grant execute on function public.reject_bond_trade(uuid)  to authenticated;
grant execute on function public.bond_order_book(uuid)    to authenticated;
grant execute on function public.bond_market_status()     to authenticated;
grant execute on function public.admin_issue_bond_series(text, numeric, numeric, int, int, numeric, numeric) to authenticated;
grant execute on function public.admin_cancel_bond_series(uuid) to authenticated;
grant execute on function public.record_bond_payment(uuid, text, date) to authenticated;
