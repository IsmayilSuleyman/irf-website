-- ============================================================
-- Owner -> one person: send a custom notification to a single shareholder
-- (resolved by name), bell + push. Same is_fund_admin gate + 'announcement'
-- kind as the broadcast; mirrors admin_send_debt_notice's return shape.
-- ============================================================

create or replace function public.admin_send_user_notice(
  p_holder_name text,
  p_title       text,
  p_body        text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid;
  v_subs   jsonb := '[]'::jsonb;
  v_unread int := 0;
  v_title  text := coalesce(nullif(btrim(p_title), ''), 'Elan');
begin
  if not public.is_fund_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_body is null or btrim(p_body) = '' then
    raise exception 'message required';
  end if;

  select u.id into v_uid
    from auth.users u
   where public.norm(coalesce(
           u.raw_user_meta_data ->> 'full_name',
           u.raw_user_meta_data ->> 'name',
           u.raw_user_meta_data ->> 'display_name', '')) = public.norm(p_holder_name)
   order by u.created_at limit 1;
  if v_uid is null then
    return jsonb_build_object('sent', false, 'unread', 0, 'subs', '[]'::jsonb);
  end if;

  insert into public.notifications (user_id, kind, title, body)
  values (v_uid, 'announcement', v_title, p_body);

  select coalesce(jsonb_agg(jsonb_build_object(
           'endpoint', endpoint, 'p256dh', p256dh, 'auth', auth)), '[]'::jsonb)
    into v_subs
    from public.push_subscriptions where user_id = v_uid;
  select count(*) into v_unread
    from public.notifications
   where user_id = v_uid and not read and created_at >= now() - interval '3 days';

  return jsonb_build_object('sent', true, 'unread', v_unread, 'subs', v_subs);
end;
$$;

revoke execute on function public.admin_send_user_notice(text, text, text) from public, anon;
grant execute on function public.admin_send_user_notice(text, text, text) to authenticated;
