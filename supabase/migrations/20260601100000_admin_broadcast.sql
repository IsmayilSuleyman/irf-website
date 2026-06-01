-- ============================================================
-- Owner broadcast: İsmayıl (is_fund_admin) sends a custom notification to
-- EVERY user — bell + (via the routes) a Web Push banner. New kind
-- 'announcement'.
-- ============================================================

alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('match', 'settled', 'payment_due', 'debt_notice', 'announcement'));

create or replace function public.admin_broadcast_notification(
  p_title text,
  p_body  text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := coalesce(nullif(btrim(p_title), ''), 'Elan');
  v_count int;
  v_subs  jsonb;
begin
  if not public.is_fund_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_body is null or btrim(p_body) = '' then
    raise exception 'message required';
  end if;

  insert into public.notifications (user_id, kind, title, body)
  select u.id, 'announcement', v_title, p_body
  from auth.users u;
  get diagnostics v_count = row_count;

  -- Every subscription + that user's (post-insert) unread count for the badge.
  select coalesce(jsonb_agg(jsonb_build_object(
           'endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth,
           'unread', (select count(*) from public.notifications n
                       where n.user_id = ps.user_id and not n.read
                         and n.created_at >= now() - interval '3 days'))), '[]'::jsonb)
    into v_subs
  from public.push_subscriptions ps;

  return jsonb_build_object('sent', v_count, 'subs', v_subs);
end;
$$;

revoke execute on function public.admin_broadcast_notification(text, text) from public, anon;
grant execute on function public.admin_broadcast_notification(text, text) to authenticated;
