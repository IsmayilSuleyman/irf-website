-- Replace the SECURITY DEFINER view with a definer function (clears the view lint).
drop view if exists public.order_book_public;
create or replace function public.order_book()
returns table(side text, price numeric, units numeric, order_count int)
language sql stable security definer set search_path = public, pg_temp as $$
  select side, price, sum(remaining_units)::numeric as units, count(*)::int as order_count
  from public.orders
  where status in ('open','partial') and remaining_units > 0
  group by side, price
  order by side, price
$$;
revoke execute on function public.order_book() from public, anon;
grant  execute on function public.order_book() to authenticated;

-- Pin norm's search_path.
create or replace function public.norm(p text)
returns text language sql immutable set search_path = pg_catalog, pg_temp as $$
  select lower(regexp_replace(translate(btrim(coalesce(p,'')), 'İIı', 'iii'), '\s+', ' ', 'g'))
$$;

-- Limit the remaining definer helpers to signed-in users (drop the default PUBLIC/anon grant).
revoke execute on function public.is_fund_admin()        from public, anon;
revoke execute on function public.market_status()        from public, anon;
revoke execute on function public.my_available_to_sell() from public, anon;
