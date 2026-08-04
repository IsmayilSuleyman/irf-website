-- ============================================================
-- Exit facts on the weekly momentum snapshot. The sell side of the ticket
-- (Satış siqnalları) confirms a broken trend over consecutive periods, the
-- same anti-whipsaw discipline the buy side uses — but confirmation needs
-- per-week history of the exit conditions, and the table only stored the
-- composite score and rank. Four nullable columns join each snapshot row:
--
--   above_200  price above its 200-day average (Faber's trend rule)
--   beats_spy  13W return above SPY's (relative momentum)
--   ret_13w    13W return, fraction (absolute momentum sign)
--   ret_4w     4W return, fraction (crash guard: sharp-drop watch flag)
--
-- Nullable on purpose: rows written before this migration carry NULLs, and
-- the sell logic treats "unknown" as breaking the confirmation chain rather
-- than guessing — SAT verdicts only appear once real flag history exists.
-- ============================================================

alter table public.momentum_week_history
  add column if not exists above_200 boolean,
  add column if not exists beats_spy boolean,
  add column if not exists ret_13w   numeric,
  add column if not exists ret_4w    numeric;

-- Both writers gain the new fields. Missing JSON keys cast to NULL, so old
-- clients keep working mid-deploy. Bodies otherwise identical to
-- 20260730120000 / 20260804120000.

create or replace function public.record_momentum_week(p_rows jsonb)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_week  date;
  v_count int;
begin
  -- Admin-only: this row set steers a week of buy advice.
  if not public.is_fund_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a json array';
  end if;
  if jsonb_array_length(p_rows) < 3 or jsonb_array_length(p_rows) > 200 then
    raise exception 'implausible row count';
  end if;

  v_week := (date_trunc('week', (now() at time zone 'Asia/Baku')))::date;

  insert into public.momentum_week_history
    (week_start, symbol, score, rank, close_call,
     above_200, beats_spy, ret_13w, ret_4w)
  select
    v_week,
    upper(btrim(r->>'symbol')),
    least(100, greatest(0, (r->>'score')::numeric)),
    greatest(1, (r->>'rank')::int),
    coalesce((r->>'closeCall')::boolean, false),
    (r->>'above200')::boolean,
    (r->>'beatsSpy')::boolean,
    (r->>'ret13w')::numeric,
    (r->>'ret4w')::numeric
  from jsonb_array_elements(p_rows) as r
  where btrim(coalesce(r->>'symbol', '')) <> ''
  on conflict (week_start, symbol) do nothing;

  get diagnostics v_count = row_count;

  return json_build_object('ok', true, 'week', v_week, 'inserted', v_count);
end; $$;

create or replace function public.record_momentum_week_cron(
  p_rows jsonb,
  p_secret text
)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_secret text;
  v_week   date;
  v_count  int;
begin
  select value into v_secret
    from private.app_secrets
   where name = 'payment_reminder_secret';

  if v_secret is null or p_secret is null or p_secret <> v_secret then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a json array';
  end if;
  if jsonb_array_length(p_rows) < 3 or jsonb_array_length(p_rows) > 200 then
    raise exception 'implausible row count';
  end if;

  v_week := (date_trunc('week', (now() at time zone 'Asia/Baku')))::date;

  insert into public.momentum_week_history
    (week_start, symbol, score, rank, close_call,
     above_200, beats_spy, ret_13w, ret_4w)
  select
    v_week,
    upper(btrim(r->>'symbol')),
    least(100, greatest(0, (r->>'score')::numeric)),
    greatest(1, (r->>'rank')::int),
    coalesce((r->>'closeCall')::boolean, false),
    (r->>'above200')::boolean,
    (r->>'beatsSpy')::boolean,
    (r->>'ret13w')::numeric,
    (r->>'ret4w')::numeric
  from jsonb_array_elements(p_rows) as r
  where btrim(coalesce(r->>'symbol', '')) <> ''
  on conflict (week_start, symbol) do nothing;

  get diagnostics v_count = row_count;

  return json_build_object('ok', true, 'week', v_week, 'inserted', v_count);
end; $$;

-- Backfill this week's already-cemented snapshot (2026-08-03 was written
-- before these columns existed) is deliberately NOT done here: the RPC pins
-- writes to the current week and the sell logic tolerates NULLs. The next
-- Monday cron writes complete rows.
