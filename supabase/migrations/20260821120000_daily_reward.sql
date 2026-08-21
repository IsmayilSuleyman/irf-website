-- ============================================================
-- Günlük mükafat: signing in and claiming pays 0,10 ₼ once per
-- Baku calendar day. Claims land in an append-only ledger — the
-- balance İsmayıl periodically settles into holders' real money
-- outside the app. All writes go through the RPC (one claim per
-- day enforced by the primary key, never by the client); holders
-- read their own history, İsmayıl reads everyone's for settlement.
-- ============================================================

create table if not exists public.daily_reward_claims (
  user_id     uuid not null references auth.users (id) on delete cascade,
  claim_date  date not null,
  -- Display name captured at claim time so the admin settlement view
  -- needs no auth.users join.
  holder_name text not null default '',
  amount_azn  numeric not null check (amount_azn > 0 and amount_azn <= 10),
  created_at  timestamptz not null default now(),
  primary key (user_id, claim_date)
);

alter table public.daily_reward_claims enable row level security;

-- Holders see their own claims; the admin sees all (settlement view).
drop policy if exists "daily_reward_claims read" on public.daily_reward_claims;
create policy "daily_reward_claims read" on public.daily_reward_claims
  for select to authenticated
  using (auth.uid() = user_id or public.is_fund_admin());

revoke all on public.daily_reward_claims from anon, authenticated;
grant select on public.daily_reward_claims to authenticated;
-- No insert/update/delete grants: the security-definer RPC below is the
-- only write path.

-- Claim today's reward. Idempotent: a repeat call the same Baku day is a
-- no-op that reports claimed=false. The date comes from the server clock,
-- never from the client.
create or replace function public.claim_daily_reward(p_holder_name text default '')
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid      uuid := auth.uid();
  v_today    date := (now() at time zone 'Asia/Baku')::date;
  v_amount   numeric := 0.10;
  v_inserted boolean := false;
begin
  if v_uid is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.daily_reward_claims (user_id, claim_date, holder_name, amount_azn)
  values (v_uid, v_today, left(coalesce(trim(p_holder_name), ''), 80), v_amount)
  on conflict (user_id, claim_date) do nothing;
  v_inserted := found;

  return json_build_object(
    'claimed', v_inserted,
    'claim_date', v_today,
    'amount_azn', v_amount,
    'total_azn', (
      select coalesce(sum(amount_azn), 0)
      from public.daily_reward_claims
      where user_id = v_uid
    )
  );
end; $$;

revoke all on function public.claim_daily_reward(text) from public, anon;
grant execute on function public.claim_daily_reward(text) to authenticated;
