-- ============================================================
-- Session-history snapshots go minutely, and stop depending on visitors.
--
-- Until now the hover charts (Açılışdan əvvəl / Bağlanışdan sonra badge,
-- the market-countdown chip) were fed ONLY by dashboard renders, in
-- 10-minute buckets — a quiet week left ~30 points in total. Now:
--   * the minutely pg_cron recorder (/api/record-minute) writes the
--     session % itself through record_session_minute, gated by the same
--     Vault bearer as record_minute_snapshot;
--   * render-time writes (record_extended_snapshot) bucket to the minute
--     too, so a viewer fills any minute the cron missed.
-- First write per minute wins on both paths (same bucket primary key).
-- Both definitions were checked against prod before this migration.
-- ============================================================

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

  -- Floor to the minute; first write in a bucket wins.
  v_bucket := date_trunc('minute', now());
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

-- The cron's path: no user session, so the Vault bearer is the gate (the
-- record_minute_snapshot recipe). Same validation and retention as above.
create or replace function public.record_session_minute(
  p_secret text,
  p_mode text,
  p_change_pct numeric
)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_expected text;
  v_bucket timestamptz := date_trunc('minute', now());
  v_inserted boolean := false;
begin
  select decrypted_secret into v_expected
  from vault.decrypted_secrets where name = 'minute-cron-bearer';
  if v_expected is null or p_secret is distinct from v_expected then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_mode not in ('pre','post','regular') then raise exception 'invalid mode'; end if;
  if p_change_pct is null or p_change_pct < -1 or p_change_pct > 1 then
    raise exception 'invalid change_pct';
  end if;

  insert into public.extended_hours_history (bucket_start, mode, change_pct)
  values (v_bucket, p_mode, p_change_pct)
  on conflict (bucket_start) do nothing;
  v_inserted := found;

  delete from public.extended_hours_history
  where bucket_start < now() - interval '7 days';

  return json_build_object('recorded', v_inserted, 'bucket', v_bucket);
end; $$;

revoke all on function public.record_session_minute(text, text, numeric) from public;
grant execute on function public.record_session_minute(text, text, numeric) to anon, authenticated;
