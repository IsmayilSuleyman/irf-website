-- ============================================================
-- İsmayılBank bonds (istiqraz): core schema.
-- Coupon bonds issued by İsmayılBank (the principal): fixed face
-- value, annual coupon rate paid every coupon_period_months, and a
-- maturity date when the face value is repaid. Users buy the primary
-- issue from the bank and trade P2P on a Bazar-style order book.
-- Mirrors the market-orders lockdown: clients can only SELECT;
-- every write goes through SECURITY DEFINER RPCs.
-- Whole units only (an istiqraz is indivisible), hence int columns.
-- ============================================================

create table if not exists public.bond_series (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null unique,
  face_value_azn       numeric not null check (face_value_azn > 0),
  coupon_rate_pct      numeric not null check (coupon_rate_pct >= 0 and coupon_rate_pct <= 100),
  coupon_period_months int not null check (coupon_period_months > 0),
  issue_price_azn      numeric not null check (issue_price_azn > 0),
  total_units          int not null check (total_units > 0),
  issue_date           date not null default current_date,
  maturity_date        date not null,
  status               text not null default 'active' check (status in ('active','matured','cancelled')),
  created_at           timestamptz not null default now(),
  created_by           uuid,
  constraint bond_series_dates check (maturity_date > issue_date)
);

create table if not exists public.bond_orders (
  id              uuid primary key default gen_random_uuid(),
  series_id       uuid not null references public.bond_series(id),
  user_id         uuid not null,
  holder_name     text not null,
  side            text not null check (side in ('buy','sell')),
  units           int  not null check (units > 0),
  remaining_units int  not null check (remaining_units >= 0),
  price           numeric not null check (price > 0),
  status          text not null default 'open' check (status in ('open','partial','filled','cancelled')),
  hidden          boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists bond_orders_open_buy_idx  on public.bond_orders (series_id, price desc, created_at) where side='buy'  and status in ('open','partial');
create index if not exists bond_orders_open_sell_idx on public.bond_orders (series_id, price asc,  created_at) where side='sell' and status in ('open','partial');
create index if not exists bond_orders_user_idx      on public.bond_orders (user_id);

-- Pending until İsmayıl confirms off-platform settlement (like share trades).
-- counterparty_kind: 'primary' = bought from the bank's unissued inventory,
-- 'p2p' = holder-to-holder.
create table if not exists public.bond_trades (
  id                uuid primary key default gen_random_uuid(),
  series_id         uuid not null references public.bond_series(id),
  buy_order_id      uuid references public.bond_orders(id),
  sell_order_id     uuid references public.bond_orders(id),
  buyer_user_id     uuid,
  seller_user_id    uuid,
  buyer_name        text not null,
  seller_name       text not null,
  units             int not null check (units > 0),
  price             numeric not null check (price > 0),
  counterparty_kind text not null check (counterparty_kind in ('p2p','primary')),
  status            text not null default 'pending' check (status in ('pending','settled','cancelled')),
  created_at        timestamptz not null default now(),
  settled_at        timestamptz,
  confirmed_by      uuid
);
create index if not exists bond_trades_series_idx on public.bond_trades (series_id, status);
create index if not exists bond_trades_buyer_idx  on public.bond_trades (buyer_user_id);
create index if not exists bond_trades_seller_idx on public.bond_trades (seller_user_id);
create index if not exists bond_trades_names_idx  on public.bond_trades (buyer_name, seller_name);

-- Ledger of coupon / principal payments İsmayıl has made off-platform.
-- One row per (series, due date, holder, kind); uniqueness is on the
-- normalized holder name so a re-run cannot double-record a payment.
create table if not exists public.bond_payments (
  id           uuid primary key default gen_random_uuid(),
  series_id    uuid not null references public.bond_series(id),
  payment_kind text not null check (payment_kind in ('coupon','principal')),
  due_date     date not null,
  holder_name  text not null,
  user_id      uuid,
  units        int not null check (units > 0),
  amount_azn   numeric not null check (amount_azn >= 0),
  paid_at      timestamptz not null default now(),
  recorded_by  uuid
);
create unique index if not exists bond_payments_unique_idx
  on public.bond_payments (series_id, payment_kind, due_date, public.norm(holder_name));
create index if not exists bond_payments_series_idx on public.bond_payments (series_id, due_date);
create index if not exists bond_payments_user_idx   on public.bond_payments (user_id);

-- ------------------------------------------------------------
-- RLS + grants: SELECT only; all writes through definer RPCs.
-- ------------------------------------------------------------
alter table public.bond_series   enable row level security;
alter table public.bond_orders   enable row level security;
alter table public.bond_trades   enable row level security;
alter table public.bond_payments enable row level security;

drop policy if exists "bond_series read" on public.bond_series;
create policy "bond_series read" on public.bond_series
  for select to authenticated using (true);

drop policy if exists "bond_orders select own" on public.bond_orders;
create policy "bond_orders select own" on public.bond_orders
  for select to authenticated using (user_id = auth.uid() or public.is_fund_admin());

drop policy if exists "bond_trades select own" on public.bond_trades;
create policy "bond_trades select own" on public.bond_trades
  for select to authenticated
  using (buyer_user_id = auth.uid() or seller_user_id = auth.uid() or public.is_fund_admin());

drop policy if exists "bond_payments select own" on public.bond_payments;
create policy "bond_payments select own" on public.bond_payments
  for select to authenticated using (user_id = auth.uid() or public.is_fund_admin());

revoke all on public.bond_series   from anon, authenticated;
revoke all on public.bond_orders   from anon, authenticated;
revoke all on public.bond_trades   from anon, authenticated;
revoke all on public.bond_payments from anon, authenticated;

grant select on public.bond_series   to authenticated;
grant select on public.bond_orders   to authenticated;
grant select on public.bond_trades   to authenticated;
grant select on public.bond_payments to authenticated;
