-- ============================================================
-- Market: keep fund_config.unit_price tracking the live Sheet price.
--
-- The bazar badge, the Fund buyback/sell shortcuts, and the matching engine
-- all read fund_config.unit_price. Until now it only changed when the admin
-- ran "Cədvəldən sinxronla", so the bazar drifted from the live Sheet price the
-- dashboard shows. The Next.js /market render now reads the Sheet price
-- server-side and pushes it here via refresh_fund_price().
--
-- The price comes only from the trusted server, never the client: the RPC is
-- gated by a shared secret kept in a private table that anon/authenticated
-- cannot read. Same threat model as the admin-gated sync (an arbitrary caller
-- must not be able to move the Satış floor / Alış cap), minus the need for an
-- admin session — and no service-role key is introduced.
-- ============================================================

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists private.app_secrets (
  name  text primary key,
  value text not null
);
revoke all on private.app_secrets from anon, authenticated;

create or replace function public.refresh_fund_price(p_unit_price numeric, p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select value into v_secret
    from private.app_secrets
   where name = 'market_refresh_secret';

  -- No secret configured yet, or a mismatch → reject (safe default: the RPC
  -- does nothing until the secret is provisioned).
  if v_secret is null or p_secret is null or p_secret <> v_secret then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_unit_price is null or p_unit_price <= 0 then
    raise exception 'unit price must be positive';
  end if;

  update public.fund_config
     set unit_price = p_unit_price,
         updated_at = now()
   where id = 1;
end;
$$;

revoke execute on function public.refresh_fund_price(numeric, text) from public, anon;
grant  execute on function public.refresh_fund_price(numeric, text) to authenticated;
