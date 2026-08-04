-- ============================================================
-- record_momentum_week_cron: the same week-cementing insert as
-- record_momentum_week, authorized by the shared cron secret instead of an
-- admin session. The render-triggered write sampled "whenever the admin first
-- opened the dashboard that week" — so the week's official scores depended on
-- login luck, and a vacation left gaps. The daily record-price cron now calls
-- this on Baku Mondays (00:00 Baku — US markets shut since Friday, so the
-- sample is a deterministic Friday close); the admin-render write remains as
-- a fallback and first-write-wins arbitrates.
--
-- Secret: private.app_secrets 'payment_reminder_secret' — deliberately the
-- SAME row the reminder RPCs check. One cron trust domain, nothing new to
-- provision out of band (preserving the design note in
-- 20260730120000_momentum_week_history.sql: nothing that silently disables
-- the feature if a fresh secret is forgotten). anon may call; the secret, not
-- the role, is the guard — the same threat model as remind_payment_due().
-- ============================================================

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
  -- Same degraded-board backstop as record_momentum_week.
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

revoke execute on function public.record_momentum_week_cron(jsonb, text) from public;
grant  execute on function public.record_momentum_week_cron(jsonb, text) to anon, authenticated;
