-- Bucketed reads for the daily/weekly/monthly charts: last row per
-- p_step_minutes bucket over the last p_hours, with the requested
-- holder's combined value (İRF slice + ETF book) extracted in-database so
-- the payload stays a few numbers per point instead of the holders blob.
-- SECURITY INVOKER: the table's RLS (authenticated read) applies.
create or replace function public.get_minute_series(
  p_step_minutes int,
  p_hours int,
  p_holder text default null
)
returns table (t timestamptz, price numeric, fund numeric, holder_v numeric)
language sql
stable
as $$
  select distinct on (bucket)
    minute_bucket as t,
    unit_price_azn as price,
    fund_total_azn as fund,
    case when p_holder is null then null else (
      select (h->>'v')::numeric + coalesce((h->>'a')::numeric, 0)
      from jsonb_array_elements(holders) h
      where lower(trim(h->>'n')) = lower(trim(p_holder))
      limit 1
    ) end as holder_v
  from public.fund_minute_snapshots,
    lateral (select to_timestamp(
      floor(extract(epoch from minute_bucket) / (greatest(p_step_minutes, 1) * 60))
      * greatest(p_step_minutes, 1) * 60
    ) as bucket) b
  where minute_bucket >= now() - make_interval(hours => greatest(p_hours, 1))
  order by bucket, minute_bucket desc
$$;

revoke all on function public.get_minute_series(int, int, text) from public, anon;
grant execute on function public.get_minute_series(int, int, text) to authenticated;

-- Retention grows to 45 days so a "1 ay" chart always has a full window.
create or replace function public.record_minute_snapshot(
  p_secret text,
  p_unit_price_azn numeric,
  p_fund_total_azn numeric,
  p_delta_azn numeric default 0,
  p_mode text default null,
  p_holders jsonb default '[]'::jsonb
)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_expected text;
  v_inserted boolean := false;
begin
  select decrypted_secret into v_expected
  from vault.decrypted_secrets where name = 'minute-cron-bearer';
  if v_expected is null or p_secret is distinct from v_expected then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_unit_price_azn is null or p_unit_price_azn < 0
     or p_fund_total_azn is null then
    raise exception 'invalid snapshot values';
  end if;

  insert into public.fund_minute_snapshots
    (minute_bucket, unit_price_azn, fund_total_azn, delta_azn, mode, holders)
  values
    (date_trunc('minute', now()), p_unit_price_azn, p_fund_total_azn,
     coalesce(p_delta_azn, 0), p_mode, coalesce(p_holders, '[]'::jsonb))
  on conflict (minute_bucket) do nothing;
  v_inserted := found;

  delete from public.fund_minute_snapshots
   where taken_at < now() - interval '45 days';

  return json_build_object('recorded', v_inserted,
    'minute', date_trunc('minute', now()));
end; $$;
