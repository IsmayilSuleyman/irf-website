-- Show the orderer's name in the order book: return per-order rows (not
-- aggregated) including holder_name. Still SECURITY DEFINER + authenticated-only.
drop function if exists public.order_book();
create function public.order_book()
returns table(side text, price numeric, units numeric, holder_name text)
language sql stable security definer set search_path = public, pg_temp as $$
  select side, price, remaining_units::numeric as units, holder_name
  from public.orders
  where status in ('open','partial') and remaining_units > 0 and hidden = false
  order by side, price desc, created_at;
$$;
revoke execute on function public.order_book() from public, anon;
grant  execute on function public.order_book() to authenticated;
