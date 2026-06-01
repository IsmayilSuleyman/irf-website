-- ============================================================
-- İsmayılBank: admin-triggered "pay your debt" notices.
--
-- The fund admin (is_fund_admin) can, on demand, push a debt reminder to a
-- borrower's bell. Uses a separate kind 'debt_notice' so the automated
-- payment-reminder reconcile (which manages only 'payment_due') never deletes
-- these. Authorization is is_fund_admin() — called from the admin's own logged-in
-- session, so no shared secret is needed (unlike the cron's secret-gated RPCs).
-- ============================================================

alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('match', 'settled', 'payment_due', 'debt_notice'));

create or replace function public.admin_send_debt_notice(
  p_holder_name text,
  p_title       text,
  p_body        text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  if not public.is_fund_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select u.id into v_uid
    from auth.users u
   where public.norm(coalesce(
           u.raw_user_meta_data ->> 'full_name',
           u.raw_user_meta_data ->> 'name',
           u.raw_user_meta_data ->> 'display_name', '')) = public.norm(p_holder_name)
   order by u.created_at
   limit 1;

  if v_uid is null then
    return false; -- no app user linked to this borrower
  end if;

  -- No dedupe_key: an on-demand notice is a deliberate push and may be re-sent.
  insert into public.notifications (user_id, kind, title, body)
  values (v_uid, 'debt_notice', p_title, p_body);

  return true;
end;
$$;

revoke execute on function public.admin_send_debt_notice(text, text, text) from public, anon;
grant execute on function public.admin_send_debt_notice(text, text, text) to authenticated;
