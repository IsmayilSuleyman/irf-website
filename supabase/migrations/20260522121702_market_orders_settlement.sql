-- ============================================================
-- Settlement: confirm (admin) commits ownership; reject restores order qty.
-- Only 'settled' trades count toward effective holdings.
-- ============================================================
create or replace function public.confirm_trade(p_trade_id uuid)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare t record;
begin
  if not public.is_fund_admin() then raise exception 'not authorized' using errcode='42501'; end if;
  select * into t from public.trades where id = p_trade_id for update;
  if not found then raise exception 'trade not found'; end if;
  if t.status <> 'pending' then raise exception 'trade is not pending (status %)', t.status; end if;
  update public.trades set status='settled', settled_at=now(), confirmed_by=auth.uid()
  where id = p_trade_id;
  return json_build_object('ok', true);
end; $$;

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

  -- Return the unsettled units to the originating orders (unless already cancelled).
  if t.buy_order_id is not null then
    update public.orders set remaining_units = remaining_units + t.units,
      status = case when remaining_units + t.units >= units then 'open' else 'partial' end
    where id = t.buy_order_id and status in ('open','partial','filled');
  end if;
  if t.sell_order_id is not null then
    update public.orders set remaining_units = remaining_units + t.units,
      status = case when remaining_units + t.units >= units then 'open' else 'partial' end
    where id = t.sell_order_id and status in ('open','partial','filled');
  end if;

  return json_build_object('ok', true);
end; $$;

revoke execute on function public.confirm_trade(uuid) from public, anon;
revoke execute on function public.reject_trade(uuid)  from public, anon;
grant  execute on function public.confirm_trade(uuid) to authenticated;
grant  execute on function public.reject_trade(uuid)  to authenticated;
