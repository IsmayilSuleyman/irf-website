-- get_minute_series, same answer at a fraction of the cost.
--
-- The dashboard calls it three times per render (1G / 1H / 1 AY tiers) and
-- waits for all three before it can send any HTML. The old body did its
-- per-row work on EVERY minute in the window — 44,640 rows for the 31-day
-- tier — before DISTINCT ON threw all but ~745 away: numeric epoch math
-- (extract(epoch) is numeric) for the bucket, a jsonb_array_elements scan
-- of the holders array for the viewer's slice, and a wide sort that spilled
-- to disk. Measured on prod (2026-11-27, warm cache): ~28 / 97 / 358 ms
-- for the day / week / month tiers; EXPLAIN ANALYZE on a cold cache showed
-- 0.4 s / 5.5 s for day / month.
--
-- Now: pick each bucket's newest minute first — a GROUP BY over
-- date_bin() (timestamp-native) on the minute_bucket key alone — then join
-- those ~745 rows back for their prices and the holder lookup. Same rows
-- and values (verified read-only on prod with EXCEPT ALL in both
-- directions across all three tiers plus NULL, unknown and zero-step
-- inputs: 4,456 rows, zero differences) and the same ascending order (one
-- row per bucket, so minute order IS bucket order); ~50 ms for all three
-- tiers together.
--
-- Bucket boundaries are unchanged: to_timestamp(floor(epoch / s) * s) and
-- date_bin(s, ts, 'epoch') are the same floor for every post-1970 instant.
-- Signature and return type are unchanged, so CREATE OR REPLACE keeps the
-- existing grants (authenticated only).
create or replace function public.get_minute_series(
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
  select
    s.minute_bucket as t,
    s.unit_price_azn as price,
    s.fund_total_azn as fund,
    hx.v as holder_v,
    hx.a as holder_a
  from (
    select max(minute_bucket) as minute_bucket
    from public.fund_minute_snapshots
    where minute_bucket >= now() - make_interval(hours => greatest(p_hours, 1))
    group by date_bin(
      make_interval(mins => greatest(p_step_minutes, 1)),
      minute_bucket,
      timestamptz 'epoch'
    )
  ) picks
  join public.fund_minute_snapshots s using (minute_bucket)
  left join lateral (
      select
        (h->>'v')::numeric + coalesce((h->>'a')::numeric, 0) as v,
        coalesce((h->>'a')::numeric, 0) as a
      from jsonb_array_elements(s.holders) h
      where p_holder is not null
        and lower(trim(h->>'n')) = lower(trim(p_holder))
      limit 1
    ) hx on true
  order by s.minute_bucket
$$;
