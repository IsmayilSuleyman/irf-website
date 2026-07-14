-- ============================================================
-- At İsmayıl's request: the principal may now buy from the primary
-- issue too. The original exclusion (cloned from the share market's
-- fund fallback) prevented self-dealing, but this is his bank and he
-- explicitly wants to be able to take up his own issues — e.g. to
-- seed a series before offering it P2P. Only the primary-fill
-- condition changes; everything else matches the previous
-- (bond_payment_hardening) definition of place_bond_order.
-- ============================================================
create or replace function public.place_bond_order(
  p_series_id uuid, p_side text, p_units numeric, p_price numeric)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid          uuid := auth.uid();
  v_holder       text;
  v_principal    text;
  s              record;
  v_today        date := (now() at time zone 'Asia/Baku')::date;
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
  if v_today >= s.maturity_date then
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
    -- Open to every buyer — including the principal, at his own request.
    if v_remaining > 0 and p_price >= s.issue_price_azn then
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

revoke execute on function public.place_bond_order(uuid, text, numeric, numeric) from public, anon;
grant  execute on function public.place_bond_order(uuid, text, numeric, numeric) to authenticated;
