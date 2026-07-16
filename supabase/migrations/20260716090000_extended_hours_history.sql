-- ============================================================
-- Extended-hours portfolio history: one snapshot of the fund's
-- pre/after-market % move per 10-minute bucket, recorded
-- opportunistically by dashboard renders (no cron slot available on
-- the hosting plan). Feeds the hover graph on the session badge.
-- Trust model mirrors fund_settings: any signed-in holder's render may
-- record, but the value is server-computed, clamped, and the bucket
-- upsert is first-write-wins — a client cannot rewrite history.
-- Self-pruning to 7 days.
-- ============================================================
create table if not exists public.extended_hours_history (
  bucket_start timestamptz primary key,
  mode         text not null check (mode in ('pre','post')),
  change_pct   numeric not null check (change_pct >= -1 and change_pct <= 1),
  recorded_at  timestamptz not null default now()
);

alter table public.extended_hours_history enable row level security;

drop policy if exists "extended_hours_history read" on public.extended_hours_history;
create policy "extended_hours_history read" on public.extended_hours_history
  for select to authenticated using (true);

revoke all on public.extended_hours_history from anon, authenticated;
grant select on public.extended_hours_history to authenticated;

create or replace function public.record_extended_snapshot(p_mode text, p_change_pct numeric)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_bucket timestamptz;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode='42501'; end if;
  if p_mode not in ('pre','post') then raise exception 'invalid mode'; end if;
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
