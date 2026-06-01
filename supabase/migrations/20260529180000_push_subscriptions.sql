-- ============================================================
-- Web Push subscriptions for the PWA app-icon badge + banners.
-- One row per browser/device push endpoint. Users manage only their own;
-- the send-push edge function reads them via the service role.
-- ============================================================

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

drop policy if exists "push_subs select own" on public.push_subscriptions;
create policy "push_subs select own" on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "push_subs insert own" on public.push_subscriptions;
create policy "push_subs insert own" on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "push_subs update own" on public.push_subscriptions;
create policy "push_subs update own" on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "push_subs delete own" on public.push_subscriptions;
create policy "push_subs delete own" on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());
