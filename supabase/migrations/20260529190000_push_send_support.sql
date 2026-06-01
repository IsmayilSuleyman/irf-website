-- ============================================================
-- Make the notification RPCs return what the app needs to send Web Push:
-- the target user's push subscriptions + their unread count (for the icon
-- badge). The Next.js routes (reminder cron + admin notice) do the actual
-- send via the web-push library and VAPID. sync also reports which reminders
-- were *newly* inserted, so a banner only pops the first day (not on every
-- daily refresh).
-- ============================================================

create or replace function public.sync_payment_notifications(
  p_name   text,
  p_items  jsonb,
  p_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret   text;
  v_uid      uuid;
  v_keys     text[];
  v_item     jsonb;
  v_inserted boolean;
  v_new      text[] := '{}';
  v_deleted  int;
  v_subs     jsonb := '[]'::jsonb;
  v_unread   int := 0;
begin
  select value into v_secret
    from private.app_secrets where name = 'payment_reminder_secret';
  if v_secret is null or p_secret is null or p_secret <> v_secret then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select u.id into v_uid
    from auth.users u
   where public.norm(coalesce(
           u.raw_user_meta_data ->> 'full_name',
           u.raw_user_meta_data ->> 'name',
           u.raw_user_meta_data ->> 'display_name', '')) = public.norm(p_name)
   order by u.created_at limit 1;
  if v_uid is null then
    return jsonb_build_object('linked', false, 'active', 0, 'deleted', 0,
      'new', '[]'::jsonb, 'unread', 0, 'subs', '[]'::jsonb);
  end if;

  select coalesce(array_agg(v_uid::text || ':' || (it ->> 'k')), array[]::text[])
    into v_keys
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as it;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.notifications (user_id, kind, title, body, dedupe_key, read, created_at)
    values (v_uid, 'payment_due', v_item ->> 'title', v_item ->> 'body',
            v_uid::text || ':' || (v_item ->> 'k'), false, now())
    on conflict (dedupe_key) do update
      set title = excluded.title, body = excluded.body, read = false, created_at = now()
    returning (xmax = 0) into v_inserted;
    if v_inserted then v_new := array_append(v_new, v_item ->> 'k'); end if;
  end loop;

  with del as (
    delete from public.notifications
     where user_id = v_uid and kind = 'payment_due' and not (dedupe_key = any(v_keys))
     returning 1
  )
  select count(*) into v_deleted from del;

  if array_length(v_new, 1) > 0 then
    select coalesce(jsonb_agg(jsonb_build_object(
             'endpoint', endpoint, 'p256dh', p256dh, 'auth', auth)), '[]'::jsonb)
      into v_subs
      from public.push_subscriptions where user_id = v_uid;
    select count(*) into v_unread
      from public.notifications
     where user_id = v_uid and read = false and created_at >= now() - interval '3 days';
  end if;

  return jsonb_build_object(
    'linked', true,
    'active', coalesce(array_length(v_keys, 1), 0),
    'deleted', v_deleted,
    'new', to_jsonb(coalesce(v_new, '{}')),
    'unread', v_unread,
    'subs', v_subs
  );
end;
$$;

-- Return type changes boolean -> jsonb, so the old function must be dropped first.
drop function if exists public.admin_send_debt_notice(text, text, text);
create function public.admin_send_debt_notice(
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
   order by u.created_at limit 1;
  if v_uid is null then
    return jsonb_build_object('sent', false, 'unread', 0, 'subs', '[]'::jsonb);
  end if;

  insert into public.notifications (user_id, kind, title, body)
  values (v_uid, 'debt_notice', p_title, p_body);

  select coalesce(jsonb_agg(jsonb_build_object(
           'endpoint', endpoint, 'p256dh', p256dh, 'auth', auth)), '[]'::jsonb)
    into v_subs
    from public.push_subscriptions where user_id = v_uid;
  select count(*) into v_unread
    from public.notifications
   where user_id = v_uid and read = false and created_at >= now() - interval '3 days';

  return jsonb_build_object('sent', true, 'unread', v_unread, 'subs', v_subs);
end;
$$;

-- admin_send_debt_notice changed return type boolean -> jsonb; keep grants.
revoke execute on function public.admin_send_debt_notice(text, text, text) from public, anon;
grant execute on function public.admin_send_debt_notice(text, text, text) to authenticated;
