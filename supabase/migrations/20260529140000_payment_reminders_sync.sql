-- ============================================================
-- İsmayılBank payment reminders: reconcile model.
--
-- The reminder should be a single live item per upcoming payment that updates
-- daily ("X gün qalıb, Y ₼") and DISAPPEARS once the payment is marked paid —
-- not an append-only log. So the daily cron now reconciles each borrower's
-- bell instead of inserting: it sends the full set of currently-active
-- reminders, this function upserts them (stable key pay:<dueDate>, refreshed
-- daily) and deletes any of the user's other payment_due notifications (paid,
-- or no longer in range) so they vanish.
--
-- Replaces create_payment_notification() as the cron's write path. That older
-- RPC is kept for now so the currently-deployed route keeps working until the
-- new route ships; it can be dropped afterward.
-- ============================================================

create or replace function public.sync_payment_notifications(
  p_name   text,
  p_items  jsonb,   -- [{ "k": "pay:2026-06-03", "title": "...", "body": "..." }, ...]
  p_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret  text;
  v_uid     uuid;
  v_keys    text[];
  v_item    jsonb;
  v_deleted int;
begin
  -- Secret gate (anon may call this RPC; the secret is the real guard).
  select value into v_secret
    from private.app_secrets
   where name = 'payment_reminder_secret';
  if v_secret is null or p_secret is null or p_secret <> v_secret then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Resolve the Sheet account name -> auth user (same norm match as elsewhere).
  select u.id into v_uid
    from auth.users u
   where public.norm(coalesce(
           u.raw_user_meta_data ->> 'full_name',
           u.raw_user_meta_data ->> 'name',
           u.raw_user_meta_data ->> 'display_name', '')) = public.norm(p_name)
   order by u.created_at
   limit 1;
  if v_uid is null then
    return jsonb_build_object('linked', false, 'active', 0, 'deleted', 0);
  end if;

  -- Per-user namespaced keys for the active reminders.
  select coalesce(array_agg(v_uid::text || ':' || (it ->> 'k')), array[]::text[])
    into v_keys
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as it;

  -- Upsert each active reminder; refresh it (unread + bumped to now) each day.
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.notifications (user_id, kind, title, body, dedupe_key, read, created_at)
    values (v_uid, 'payment_due', v_item ->> 'title', v_item ->> 'body',
            v_uid::text || ':' || (v_item ->> 'k'), false, now())
    on conflict (dedupe_key) do update
      set title = excluded.title,
          body  = excluded.body,
          read  = false,
          created_at = now();
  end loop;

  -- Remove this user's payment_due reminders that are no longer active
  -- (paid, or outside the window) so they disappear from the bell.
  with del as (
    delete from public.notifications
     where user_id = v_uid
       and kind = 'payment_due'
       and not (dedupe_key = any(v_keys))
     returning 1
  )
  select count(*) into v_deleted from del;

  return jsonb_build_object(
    'linked', true,
    'active', coalesce(array_length(v_keys, 1), 0),
    'deleted', v_deleted
  );
end;
$$;

revoke execute on function public.sync_payment_notifications(text, jsonb, text) from public;
grant execute on function public.sync_payment_notifications(text, jsonb, text) to anon, authenticated;
