-- ============================================================
-- Reward settlement: unsettled claims count into the holder's
-- displayed İsmayılBank deposit; when İsmayıl actually moves the
-- money into the Sheet deposit he marks them settled (admin RPC),
-- so the amount never double-counts. settled_at is the marker.
-- ============================================================

alter table public.daily_reward_claims
  add column if not exists settled_at timestamptz;

create index if not exists daily_reward_claims_unsettled_idx
  on public.daily_reward_claims (user_id)
  where settled_at is null;

-- Mark unsettled claims settled — all holders, or one holder by the name
-- captured at claim time (the admin card settles per holder). Reports what
-- was settled so the UI can confirm the amount moved to the Sheet.
create or replace function public.admin_settle_daily_rewards(p_holder_name text default null)
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
  from public.daily_reward_claims
  where settled_at is null
    and (p_holder_name is null or holder_name = p_holder_name);

  update public.daily_reward_claims
     set settled_at = now()
   where settled_at is null
     and (p_holder_name is null or holder_name = p_holder_name);

  return json_build_object(
    'ok', true,
    'settled_count', v_count,
    'settled_azn', v_total
  );
end; $$;

revoke all on function public.admin_settle_daily_rewards(text) from public, anon;
grant execute on function public.admin_settle_daily_rewards(text) to authenticated;
