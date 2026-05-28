-- ============================================================
-- Market: surface the live order-book extremes in market_status so the
-- "1 payın qiyməti" badge can reflect the best available prices, not just
-- the Fund's ±commission quote.
--
--   best_buy_order  = highest resting BUY price  (best bid from participants)
--   best_sell_order = lowest  resting SELL price (best ask from participants)
--
-- The app combines these with the Fund quote (computed from the live price):
--   Alış  = lowest  of { Fund ask, best_sell_order }   (cheapest way to buy)
--   Satış = highest of { Fund bid, best_buy_order }     (best price to sell)
--
-- Same visibility filter as order_book(): open/partial, remaining_units > 0,
-- not hidden. SECURITY DEFINER so it reads across holders (like order_book).
-- ============================================================

CREATE OR REPLACE FUNCTION public.market_status()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    'updated_at', c.updated_at
  ) from public.fund_config c where c.id=1
$function$;
