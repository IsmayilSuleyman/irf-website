-- Let users remove finished orders from "Sifarişlərim". Orders are referenced by
-- the trades ledger, so this is a soft delete (hide) rather than a row delete.
alter table public.orders add column if not exists hidden boolean not null default false;

-- Owner (or admin) hides a terminal (cancelled/filled) order from their list.
-- Active orders must be cancelled first.
create or replace function public.delete_order(p_order_id uuid)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); r record;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='42501'; end if;
  select * into r from public.orders where id = p_order_id;
  if not found then raise exception 'order not found'; end if;
  if r.user_id <> v_uid and not public.is_fund_admin() then
    raise exception 'not your order' using errcode='42501';
  end if;
  if r.status in ('open','partial') then
    raise exception 'cancel the order before deleting (status %)', r.status;
  end if;
  update public.orders set hidden = true where id = p_order_id;
  return json_build_object('ok', true);
end; $$;

revoke execute on function public.delete_order(uuid) from public, anon;
grant  execute on function public.delete_order(uuid) to authenticated;
