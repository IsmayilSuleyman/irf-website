-- ============================================================
-- Minutely fund snapshots: every minute — visitors or none — the
-- portal records the LIVE figures the dashboard shows: 1 payın
-- qiyməti, fondun ümumi dəyəri and each holder's İRF value, plus
-- the session behind them. Driven end-to-end from inside the
-- stack: a pg_cron job (scheduled live, outside this migration —
-- it carries the deployment URL) calls GET /api/record-minute via
-- pg_net with a bearer from Vault ('minute-cron-bearer'); the
-- route computes the figures and calls the RPC below, which
-- re-checks the same Vault secret — the database is the single
-- gatekeeper, no Vercel env needed. Retention: 30 days of minutes
-- (the daily price_history series continues forever).
--
-- Live setup already applied to the project:
--   select vault.create_secret('<secret>', 'minute-cron-bearer');
--   select cron.schedule('irf-minute-snapshot', '* * * * *', $cron$
--     select net.http_get(
--       url := 'https://<deployment>/api/record-minute',
--       headers := jsonb_build_object('Authorization',
--         'Bearer ' || (select decrypted_secret
--                        from vault.decrypted_secrets
--                        where name = 'minute-cron-bearer')),
--       timeout_milliseconds := 8000);
--   $cron$);
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.fund_minute_snapshots (
  -- The minute this row belongs to; the primary key makes recording
  -- idempotent — retries and overlapping calls cannot double-record.
  minute_bucket   timestamptz not null primary key,
  taken_at        timestamptz not null default now(),
  unit_price_azn  numeric not null check (unit_price_azn >= 0),
  fund_total_azn  numeric not null,
  -- The live session delta folded into the figures at record time, and
  -- which session produced it (null = regular hours).
  delta_azn       numeric not null default 0,
  mode            text,
  -- [{"n": name, "u": units, "v": value_azn}] per İRF holder.
  holders         jsonb not null default '[]'::jsonb
);

alter table public.fund_minute_snapshots enable row level security;

-- The family reads the series (future intraday charts); writes only
-- through the secret-gated RPC.
drop policy if exists "fund_minute_snapshots read" on public.fund_minute_snapshots;
create policy "fund_minute_snapshots read" on public.fund_minute_snapshots
  for select to authenticated using (true);

revoke all on public.fund_minute_snapshots from anon, authenticated;
grant select on public.fund_minute_snapshots to authenticated;

create index if not exists fund_minute_snapshots_taken_idx
  on public.fund_minute_snapshots (taken_at);

-- The only write path. p_secret must match the Vault secret
-- 'minute-cron-bearer' — the same value the pg_cron job sends the route,
-- which the route forwards here, so an unauthenticated caller cannot
-- insert even if it reaches the endpoint. Prunes the >30d tail on every
-- call (cheap on the taken_at index).
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
   where taken_at < now() - interval '30 days';

  return json_build_object('recorded', v_inserted,
    'minute', date_trunc('minute', now()));
end; $$;

revoke all on function public.record_minute_snapshot(text, numeric, numeric, numeric, text, jsonb) from public;
grant execute on function public.record_minute_snapshot(text, numeric, numeric, numeric, text, jsonb) to anon, authenticated;
