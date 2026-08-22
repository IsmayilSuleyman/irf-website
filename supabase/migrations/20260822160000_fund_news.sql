-- Fondumuz haqqında xəbərlər: İsmayıl posts dated news items (title, body,
-- optional image). Every signed-in holder reads them; only the fund admin
-- writes. Items older than a month move to the archive purely in the UI —
-- rows are never deleted by time.

create table if not exists public.fund_news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 8000),
  image_url text,
  -- Optional pinned market ticker (e.g. SPY, BTC-USD) — the dashboard shows
  -- its live daily change on the news banner.
  ticker text check (ticker is null or char_length(ticker) between 1 and 12),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists fund_news_created_at_idx
  on public.fund_news (created_at desc);

alter table public.fund_news enable row level security;

create policy "fund_news_read" on public.fund_news
  for select to authenticated using (true);

create policy "fund_news_admin_insert" on public.fund_news
  for insert to authenticated with check (public.is_fund_admin());

create policy "fund_news_admin_update" on public.fund_news
  for update to authenticated
  using (public.is_fund_admin()) with check (public.is_fund_admin());

create policy "fund_news_admin_delete" on public.fund_news
  for delete to authenticated using (public.is_fund_admin());

-- Public-read bucket for attached pictures; only the admin uploads.
insert into storage.buckets (id, name, public)
values ('news', 'news', true)
on conflict (id) do nothing;

create policy "news_images_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'news' and public.is_fund_admin());

create policy "news_images_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'news' and public.is_fund_admin());
