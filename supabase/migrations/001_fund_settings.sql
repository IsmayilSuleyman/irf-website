-- Run once in Supabase Studio → SQL Editor.
-- Creates a simple key/value table for fund-wide settings the manager edits
-- from the dashboard (currently just the strategy statement).

create table if not exists public.fund_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

-- Anon clients (dashboard reads) can read; writes go through a server action
-- using the anon key while authenticated. We still keep RLS enabled so direct
-- anon writes are blocked.
alter table public.fund_settings enable row level security;

drop policy if exists "fund_settings read" on public.fund_settings;
create policy "fund_settings read"
  on public.fund_settings for select
  using (true);

drop policy if exists "fund_settings write" on public.fund_settings;
create policy "fund_settings write"
  on public.fund_settings for all
  to authenticated
  using (true)
  with check (true);

insert into public.fund_settings (key, value)
values ('strategy_statement', '')
on conflict (key) do nothing;
