-- ============================================================
-- Günlük faiz: every İsmayılBank deposit accrues interest daily
-- at 10% EFFECTIVE annual — the daily rate is the 365th root,
-- power(1.10, 1/365) − 1 ≈ 0.0261158%/day, so daily crediting
-- compounds to exactly the advertised 10% over a year. Interest
-- earned on day D becomes balance on day D+1, landing in the
-- same "Hesablaşılmamış" bucket the daily rewards use: an
-- append-only ledger İsmayıl periodically settles into the
-- Sheet deposit. All writes go through the RPCs; holders read
-- their own rows, İsmayıl reads everyone's for settlement.
-- ============================================================

create table if not exists public.bank_interest_accruals (
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- The Baku day the interest was EARNED (credited the following day).
  accrual_date date not null,
  -- Display name captured at accrual time so the admin settlement view
  -- needs no auth.users join.
  holder_name  text not null default '',
  -- The balance the day's interest was computed on (sheet deposit +
  -- unsettled rewards + unsettled interest) — kept for auditability.
  base_azn     numeric not null check (base_azn >= 0),
  amount_azn   numeric not null check (amount_azn > 0 and amount_azn <= 50),
  created_at   timestamptz not null default now(),
  settled_at   timestamptz,
  primary key (user_id, accrual_date)
);

alter table public.bank_interest_accruals enable row level security;

-- Holders see their own accruals; the admin sees all (settlement view).
drop policy if exists "bank_interest_accruals read" on public.bank_interest_accruals;
create policy "bank_interest_accruals read" on public.bank_interest_accruals
  for select to authenticated
  using (auth.uid() = user_id or public.is_fund_admin());

revoke all on public.bank_interest_accruals from anon, authenticated;
grant select on public.bank_interest_accruals to authenticated;
-- No insert/update/delete grants: the security-definer RPCs below are the
-- only write path.

create index if not exists bank_interest_accruals_unsettled_idx
  on public.bank_interest_accruals (user_id)
  where settled_at is null;

-- Accrue the missing days for the calling user, through YESTERDAY (Baku) —
-- day D's interest becomes balance on D+1. Idempotent: the primary key
-- makes every day accrue at most once, so repeat calls are no-ops. The
-- deposit base comes from the Google Sheet, which Postgres can't see, so
-- the app server passes it in; it is clamped to a sane family-scale cap
-- and recorded in base_azn so İsmayıl's settlement view can audit every
-- figure before any money moves. Catch-up is bounded to 60 days and uses
-- today's balance as the base for missed days (deterministic, and the
-- approximation is visible in base_azn).
create or replace function public.accrue_bank_interest(
  p_holder_name text default '',
  p_deposit_azn numeric default 0
)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid       uuid := auth.uid();
  v_yesterday date := (now() at time zone 'Asia/Baku')::date - 1;
  v_start     date;
  -- 10% effective annual → daily rate is the 365th root.
  v_rate      numeric := power(1.10::numeric, 1::numeric / 365::numeric) - 1;
  v_running   numeric;
  v_amt       numeric;
  v_day       date;
  v_days      int := 0;
  v_accrued   numeric := 0;
  v_deposit   numeric := least(greatest(coalesce(p_deposit_azn, 0), 0), 100000);
begin
  if v_uid is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select coalesce(max(accrual_date), v_yesterday - 1) + 1
    into v_start
  from public.bank_interest_accruals
  where user_id = v_uid;
  if v_start < v_yesterday - 59 then
    v_start := v_yesterday - 59;
  end if;

  if v_start <= v_yesterday then
    v_running := v_deposit
      + coalesce((select sum(amount_azn) from public.daily_reward_claims
                   where user_id = v_uid and settled_at is null), 0)
      + coalesce((select sum(amount_azn) from public.bank_interest_accruals
                   where user_id = v_uid and settled_at is null), 0);
    v_day := v_start;
    while v_day <= v_yesterday and v_running > 0 loop
      v_amt := round(v_running * v_rate, 4);
      exit when v_amt <= 0;
      insert into public.bank_interest_accruals
        (user_id, accrual_date, holder_name, base_azn, amount_azn)
      values
        (v_uid, v_day, left(coalesce(trim(p_holder_name), ''), 80),
         round(v_running, 2), v_amt)
      on conflict (user_id, accrual_date) do nothing;
      if found then
        v_days := v_days + 1;
        v_accrued := v_accrued + v_amt;
      end if;
      v_running := v_running + v_amt;
      v_day := v_day + 1;
    end loop;
  end if;

  return json_build_object(
    'accrued_days', v_days,
    'accrued_azn', v_accrued,
    'unsettled_azn', (
      select coalesce(sum(amount_azn), 0)
      from public.bank_interest_accruals
      where user_id = v_uid and settled_at is null
    )
  );
end; $$;

revoke all on function public.accrue_bank_interest(text, numeric) from public, anon;
grant execute on function public.accrue_bank_interest(text, numeric) to authenticated;

-- Mark unsettled interest settled — all holders, or one holder by the name
-- captured at accrual time — called AFTER İsmayıl has moved the amount into
-- the holder's Sheet deposit, so the displayed deposit never double-counts.
create or replace function public.admin_settle_bank_interest(p_holder_name text default null)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count int;
  v_total numeric;
begin
  if not public.is_fund_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select count(*), coalesce(sum(amount_azn), 0)
    into v_count, v_total
  from public.bank_interest_accruals
  where settled_at is null
    and (p_holder_name is null or holder_name = p_holder_name);

  update public.bank_interest_accruals
     set settled_at = now()
   where settled_at is null
     and (p_holder_name is null or holder_name = p_holder_name);

  return json_build_object(
    'ok', true,
    'settled_count', v_count,
    'settled_azn', v_total
  );
end; $$;

revoke all on function public.admin_settle_bank_interest(text) from public, anon;
grant execute on function public.admin_settle_bank_interest(text) to authenticated;
