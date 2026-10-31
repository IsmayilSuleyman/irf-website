-- get_minute_series also returns the holder's ETF-book slice (holders[].a)
-- on its own, so the fine chart ranges (1G / 1H / 1 AY) can split the
-- tooltip's Dəyər into İRF / Digər aktivlər like the daily ranges do.
-- The return type changes, so drop + recreate (grants re-applied below).
drop function if exists public.get_minute_series(int, int, text);

create function public.get_minute_series(
  p_step_minutes int,
  p_hours int,
  p_holder text default null
)
returns table (
  t timestamptz,
  price numeric,
  fund numeric,
  holder_v numeric,
  holder_a numeric
)
language sql
stable
as $$
  select distinct on (bucket)
    minute_bucket as t,
    unit_price_azn as price,
    fund_total_azn as fund,
    hx.v as holder_v,
    hx.a as holder_a
  from public.fund_minute_snapshots
  cross join lateral (select to_timestamp(
      floor(extract(epoch from minute_bucket) / (greatest(p_step_minutes, 1) * 60))
      * greatest(p_step_minutes, 1) * 60
    ) as bucket) b
  left join lateral (
      select
        (h->>'v')::numeric + coalesce((h->>'a')::numeric, 0) as v,
        coalesce((h->>'a')::numeric, 0) as a
      from jsonb_array_elements(holders) h
      where p_holder is not null
        and lower(trim(h->>'n')) = lower(trim(p_holder))
      limit 1
    ) hx on true
  where minute_bucket >= now() - make_interval(hours => greatest(p_hours, 1))
  order by bucket, minute_bucket desc
$$;

revoke all on function public.get_minute_series(int, int, text) from public, anon;
grant execute on function public.get_minute_series(int, int, text) to authenticated;
