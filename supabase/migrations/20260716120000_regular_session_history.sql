-- ============================================================
-- Regular-session (intraday) snapshots join the extended-hours ones:
-- the same 10-minute mechanism now also records the portfolio's
-- day-change % during US market hours, feeding the daily/weekly hover
-- chart on the market-countdown chip.
-- ============================================================
alter table public.extended_hours_history
  drop constraint if exists extended_hours_history_mode_check;
alter table public.extended_hours_history
  add constraint extended_hours_history_mode_check
  check (mode in ('pre','post','regular'));

create or replace function public.record_extended_snapshot(p_mode text, p_change_pct numeric)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_bucket timestamptz;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode='42501'; end if;
  if p_mode not in ('pre','post','regular') then raise exception 'invalid mode'; end if;
  if p_change_pct is null or p_change_pct < -1 or p_change_pct > 1 then
    raise exception 'invalid change_pct';
  end if;

  -- Floor to the 10-minute bucket; first write in a bucket wins.
  v_bucket := to_timestamp(floor(extract(epoch from now()) / 600) * 600);
  insert into public.extended_hours_history (bucket_start, mode, change_pct)
  values (v_bucket, p_mode, p_change_pct)
  on conflict (bucket_start) do nothing;

  -- Keep a rolling week; cheap enough to do inline.
  delete from public.extended_hours_history
  where bucket_start < now() - interval '7 days';

  return json_build_object('ok', true, 'bucket', v_bucket);
end; $$;

revoke execute on function public.record_extended_snapshot(text, numeric) from public, anon;
grant  execute on function public.record_extended_snapshot(text, numeric) to authenticated;
