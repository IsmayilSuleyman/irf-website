-- ============================================================
-- Weekly momentum snapshot: one row per (ISO week, symbol) carrying the
-- composite score that ranked the holding that week. Feeds the "Həftəlik
-- alış bileti" — the top-3 ticket and, through the score history, the
-- anti-whipsaw hysteresis deciding whether the advice holds or switches.
--
-- Trust model is deliberately STRICTER than extended_hours_history. There any
-- signed-in holder's render may record, because a poisoned 10-minute chart dot
-- is cosmetic. Here first-write-wins locks a whole WEEK, and that week steers
-- a real buy decision for seven days — so only the fund admin's render may
-- write (public.is_fund_admin(), the same gate the admin broadcast RPCs use).
-- No new shared secret is introduced: nothing to provision out of band, and
-- nothing that silently disables the feature if it is forgotten.
--
-- The week key is a DATE (ISO Monday in Asia/Baku), not a timestamptz bucket:
-- the app is Baku-centric, and date_trunc('week', now()) would anchor to UTC
-- on Supabase and cut the week at 04:00 Baku Monday.
--
-- No inline prune, unlike the 7-day session history: ~15 symbols x 52 weeks
-- is under 800 rows a year, and the hysteresis replays the series, so silently
-- deleting old weeks could change a verdict.
-- ============================================================

create table if not exists public.momentum_week_history (
  week_start  date        not null,
  symbol      text        not null,
  -- 0..100, the composite from lib/momentum.ts. NOT a fraction — do not copy
  -- the (-1..1) bound the extended-hours table uses for percentages.
  score       numeric     not null check (score >= 0 and score <= 100),
  rank        int         not null check (rank >= 1),
  close_call  boolean     not null default false,
  recorded_at timestamptz not null default now(),
  primary key (week_start, symbol)
);

alter table public.momentum_week_history enable row level security;

drop policy if exists "momentum_week_history read" on public.momentum_week_history;
create policy "momentum_week_history read" on public.momentum_week_history
  for select to authenticated using (true);

revoke all on public.momentum_week_history from anon, authenticated;
grant select on public.momentum_week_history to authenticated;

-- No secondary index: the composite PK (week_start, symbol) already serves the
-- only hot query — "the last N weeks, all symbols" — as a leading-column range
-- scan over a table that stays under four figures.

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
  -- A degraded board (Sheets read failed, factors missing) must not cement
  -- itself for the week; the caller guards too, this is the backstop.
  if jsonb_array_length(p_rows) < 3 or jsonb_array_length(p_rows) > 200 then
    raise exception 'implausible row count';
  end if;

  -- ISO Monday of the current Baku week, computed HERE so no caller can
  -- backfill or rewrite an arbitrary week.
  v_week := (date_trunc('week', (now() at time zone 'Asia/Baku')))::date;

  insert into public.momentum_week_history
    (week_start, symbol, score, rank, close_call)
  select
    v_week,
    upper(btrim(r->>'symbol')),
    least(100, greatest(0, (r->>'score')::numeric)),
    greatest(1, (r->>'rank')::int),
    coalesce((r->>'closeCall')::boolean, false)
  from jsonb_array_elements(p_rows) as r
  where btrim(coalesce(r->>'symbol', '')) <> ''
  on conflict (week_start, symbol) do nothing;

  get diagnostics v_count = row_count;

  return json_build_object('ok', true, 'week', v_week, 'inserted', v_count);
end; $$;

revoke execute on function public.record_momentum_week(jsonb) from public, anon;
grant  execute on function public.record_momentum_week(jsonb) to authenticated;
