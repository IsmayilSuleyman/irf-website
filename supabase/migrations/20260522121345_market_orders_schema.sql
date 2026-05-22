-- ============================================================
-- Market Orders: core schema (additive; price_history/auth untouched)
-- ============================================================

-- Trusted, write-protected fund config (single row).
create table if not exists public.fund_config (
  id              int primary key default 1,
  principal_name  text not null default 'İSMAYIL SÜLEYMAN',
  total_units     numeric not null default 0,
  unit_price      numeric not null default 0,
  commission      numeric not null default 0.03,
  float_cap_pct   numeric not null default 0.10,
  updated_at      timestamptz not null default now(),
  constraint fund_config_singleton check (id = 1)
);
insert into public.fund_config (id) values (1) on conflict (id) do nothing;

-- Opening balances seeded from the Google Sheet "Sahiblik" tab.
create table if not exists public.opening_balances (
  holder_name    text primary key,
  opening_units  numeric not null default 0,
  synced_at      timestamptz not null default now()
);

-- Order book.
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  holder_name     text not null,
  side            text not null check (side in ('buy','sell')),
  units           numeric not null check (units > 0),
  remaining_units numeric not null check (remaining_units >= 0),
  price           numeric not null check (price > 0),
  status          text not null default 'open' check (status in ('open','partial','filled','cancelled')),
  created_at      timestamptz not null default now()
);
create index if not exists orders_open_buy_idx  on public.orders (price desc, created_at) where side='buy'  and status in ('open','partial');
create index if not exists orders_open_sell_idx on public.orders (price asc,  created_at) where side='sell' and status in ('open','partial');
create index if not exists orders_user_idx      on public.orders (user_id);

-- Matched trades (pending until İsmayıl confirms off-platform settlement).
create table if not exists public.trades (
  id                uuid primary key default gen_random_uuid(),
  buy_order_id      uuid references public.orders(id),
  sell_order_id     uuid references public.orders(id),
  buyer_user_id     uuid,
  seller_user_id    uuid,
  buyer_name        text not null,
  seller_name       text not null,
  units             numeric not null check (units > 0),
  price             numeric not null check (price > 0),
  counterparty_kind text not null check (counterparty_kind in ('p2p','fund_buy','fund_sell')),
  status            text not null default 'pending' check (status in ('pending','settled','cancelled')),
  created_at        timestamptz not null default now(),
  settled_at        timestamptz,
  confirmed_by      uuid
);
create index if not exists trades_status_idx on public.trades (status);
create index if not exists trades_buyer_idx  on public.trades (buyer_user_id);
create index if not exists trades_seller_idx on public.trades (seller_user_id);
create index if not exists trades_names_idx  on public.trades (buyer_name, seller_name);

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------

-- Name normalization robust to Azerbaijani dotted/dotless I.
create or replace function public.norm(p text)
returns text language sql immutable as $$
  select lower(regexp_replace(translate(btrim(coalesce(p,'')), 'İIı', 'iii'), '\s+', ' ', 'g'))
$$;

-- Admin = JWT user_metadata.role='admin' OR display name matches principal_name.
create or replace function public.is_fund_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select
    coalesce((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin', false)
    or exists (
      select 1 from public.fund_config c
      where public.norm(c.principal_name) = public.norm(coalesce(
        auth.jwt() -> 'user_metadata' ->> 'full_name',
        auth.jwt() -> 'user_metadata' ->> 'name',
        auth.jwt() -> 'user_metadata' ->> 'display_name'
      ))
    )
$$;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.fund_config      enable row level security;
alter table public.opening_balances enable row level security;
alter table public.orders           enable row level security;
alter table public.trades           enable row level security;

-- fund_config: readable by logged-in users; writes only via definer sync function.
drop policy if exists "fund_config read" on public.fund_config;
create policy "fund_config read" on public.fund_config for select to authenticated using (true);

-- opening_balances: no client policies -> only definer functions can touch it.

-- orders: a user reads their own; admin reads all. Writes only via place_order/cancel_order.
drop policy if exists "orders select own" on public.orders;
create policy "orders select own" on public.orders for select to authenticated
  using (user_id = auth.uid() or public.is_fund_admin());

-- trades: a party reads their own; admin reads all. Writes only via definer functions.
drop policy if exists "trades select own" on public.trades;
create policy "trades select own" on public.trades for select to authenticated
  using (buyer_user_id = auth.uid() or seller_user_id = auth.uid() or public.is_fund_admin());

-- ------------------------------------------------------------
-- Public (anonymous) order book: aggregated, no identities.
-- View runs with owner privileges (security_invoker off) so it can aggregate
-- across all open orders without exposing base rows.
-- ------------------------------------------------------------
create or replace view public.order_book_public as
  select side, price, sum(remaining_units)::numeric as units, count(*)::int as order_count
  from public.orders
  where status in ('open','partial') and remaining_units > 0
  group by side, price;

-- ------------------------------------------------------------
-- Grants: force all writes through RPCs; only SELECT exposed to PostgREST.
-- ------------------------------------------------------------
revoke all on public.fund_config      from anon, authenticated;
revoke all on public.opening_balances from anon, authenticated;
revoke all on public.orders           from anon, authenticated;
revoke all on public.trades           from anon, authenticated;

grant select on public.fund_config to authenticated;
grant select on public.orders      to authenticated;
grant select on public.trades      to authenticated;
grant select on public.order_book_public to authenticated;
