-- ============================================================
-- Personal credit offers ("Sizin üçün XX ₼ kredit təklifimiz var!").
-- İsmayıl sets one per account in his /bank cabinet, either as a fixed AZN
-- amount or as a percent of the bank's remaining liquidity — the percent is
-- resolved AT RENDER TIME against the sheet-derived net liquidity (deposits
-- + bond funding − loans), which lives outside this database, so the table
-- stores the rule, never a stale figure.
--
-- Trust model:
--   • rows are keyed by the bank-sheet account name and matched to the
--     signed-in user via public.norm() on the JWT display name — the same
--     linkage every other holder-facing feature uses;
--   • users can SELECT their own row only (İsmayıl sees all); all writes go
--     through the admin RPCs below;
--   • the "Mənə maraqlıdır" ping is one notification to İsmayıl per holder
--     per Baku day (dedupe_key), so a tap-happy user cannot spam him. The
--     amount in the ping is computed by the server route; the RPC verifies
--     an offer row actually exists for the caller, and the notification is
--     advisory either way — İsmayıl follows up personally.
-- ============================================================

create table if not exists public.credit_offers (
  -- Account name exactly as in the bank sheet.
  holder_name text primary key,
  mode        text        not null check (mode in ('azn', 'pct')),
  value       numeric     not null check (value > 0),
  constraint credit_offers_pct_bound check (mode <> 'pct' or value <= 100),
  constraint credit_offers_azn_bound check (mode <> 'azn' or value <= 1000000),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

alter table public.credit_offers enable row level security;

drop policy if exists "credit_offers read own" on public.credit_offers;
create policy "credit_offers read own" on public.credit_offers
  for select to authenticated using (
    public.is_fund_admin()
    or public.norm(holder_name) = public.norm(coalesce(
         auth.jwt() -> 'user_metadata' ->> 'full_name',
         auth.jwt() -> 'user_metadata' ->> 'name',
         auth.jwt() -> 'user_metadata' ->> 'display_name', ''))
  );

revoke all on public.credit_offers from anon, authenticated;
grant select on public.credit_offers to authenticated;

-- ------------------------------------------------------------
-- Admin writes.
-- ------------------------------------------------------------
create or replace function public.admin_set_credit_offer(
  p_holder text,
  p_mode   text,
  p_value  numeric
)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_fund_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_holder is null or btrim(p_holder) = '' then
    raise exception 'Hesab adı tələb olunur';
  end if;
  if p_mode not in ('azn', 'pct') then
    raise exception 'Rejim azn və ya pct olmalıdır';
  end if;
  if p_value is null or p_value <= 0 then
    raise exception 'Məbləğ müsbət olmalıdır';
  end if;
  if p_mode = 'pct' and p_value > 100 then
    raise exception 'Faiz 100-dən böyük ola bilməz';
  end if;
  if p_mode = 'azn' and p_value > 1000000 then
    raise exception 'Məbləğ həddindən böyükdür';
  end if;

  insert into public.credit_offers (holder_name, mode, value, updated_at, updated_by)
  values (btrim(p_holder), p_mode, p_value, now(), auth.uid())
  on conflict (holder_name) do update
    set mode = excluded.mode,
        value = excluded.value,
        updated_at = now(),
        updated_by = excluded.updated_by;

  return json_build_object('ok', true);
end; $$;

create or replace function public.admin_delete_credit_offer(p_holder text)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count int;
begin
  if not public.is_fund_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  delete from public.credit_offers where holder_name = btrim(p_holder);
  get diagnostics v_count = row_count;
  return json_build_object('ok', true, 'deleted', v_count);
end; $$;

-- ------------------------------------------------------------
-- "Mənə maraqlıdır": one ping to İsmayıl per holder per Baku day.
-- p_amount_azn is computed server-side by the route (the pct mode needs the
-- sheet-derived liquidity this database does not have).
-- ------------------------------------------------------------
create or replace function public.credit_offer_interest(p_amount_azn numeric)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid      uuid := auth.uid();
  v_holder   text;
  v_admin    uuid;
  v_key      text;
  v_inserted boolean := false;
  v_unread   int := 0;
  v_subs     jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  v_holder := coalesce(
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() -> 'user_metadata' ->> 'name',
    auth.jwt() -> 'user_metadata' ->> 'display_name');
  if v_holder is null or btrim(v_holder) = '' then
    raise exception 'Hesabınızda ad göstərilməyib';
  end if;
  if p_amount_azn is null or p_amount_azn <= 0 or p_amount_azn > 1000000 then
    raise exception 'Yanlış məbləğ';
  end if;
  -- Only holders who actually have an offer can ping.
  if not exists (
    select 1 from public.credit_offers o
    where public.norm(o.holder_name) = public.norm(v_holder)
  ) then
    raise exception 'Sizin üçün aktiv kredit təklifi yoxdur';
  end if;

  v_admin := public.fund_admin_user_id();
  if v_admin is null then
    return json_build_object('sent', false, 'already', false);
  end if;

  v_key := 'credit-interest:' || public.norm(v_holder) || ':'
        || ((now() at time zone 'Asia/Baku')::date)::text;

  insert into public.notifications (user_id, kind, title, body, dedupe_key)
  values (
    v_admin,
    'announcement',
    'Kredit təklifinə maraq',
    format('%s %s ₼ məbləğində kredit təklifi ilə maraqlanır.',
           btrim(v_holder), to_char(p_amount_azn, 'FM999999990')),
    v_key
  )
  on conflict (dedupe_key) do nothing
  returning true into v_inserted;
  v_inserted := coalesce(v_inserted, false);

  select count(*) into v_unread from public.notifications
  where user_id = v_admin and read = false
    and created_at >= now() - interval '3 days';

  select coalesce(jsonb_agg(jsonb_build_object(
    'endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth)), '[]'::jsonb)
  into v_subs
  from public.push_subscriptions ps where ps.user_id = v_admin;

  return json_build_object(
    'sent', v_inserted, 'already', not v_inserted,
    'unread', v_unread, 'subs', v_subs);
end; $$;

-- ------------------------------------------------------------
-- Privileges.
-- ------------------------------------------------------------
revoke execute on function public.admin_set_credit_offer(text, text, numeric) from public, anon;
revoke execute on function public.admin_delete_credit_offer(text) from public, anon;
revoke execute on function public.credit_offer_interest(numeric) from public, anon;

grant execute on function public.admin_set_credit_offer(text, text, numeric) to authenticated;
grant execute on function public.admin_delete_credit_offer(text) to authenticated;
grant execute on function public.credit_offer_interest(numeric) to authenticated;
