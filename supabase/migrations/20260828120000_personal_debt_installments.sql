-- Installment plans for personal debts: a debt with "taksit sayı" set
-- becomes a finite monthly plan and renders in the CreditPanel language —
-- remaining-amount hero, progress segments, status-dot schedule. "Ödədim"
-- counts one installment and moves the due date exactly one month (a plan
-- keeps its sequence even when paid late, unlike the open-ended monthly
-- recurrence, which rolls to the next FUTURE cycle); the last installment
-- closes the debt.

alter table public.personal_debts
  add column if not exists installments_total int
    check (installments_total is null or (installments_total between 2 and 120)),
  add column if not exists installments_paid int not null default 0
    check (installments_paid >= 0);

-- New signature (p_installments added) — drop the old overload so callers
-- can't land on it.
drop function if exists public.save_personal_debt(text, date, numeric, text, int, boolean, uuid);

create or replace function public.save_personal_debt(
  p_title text,
  p_due_date date,
  p_amount_azn numeric default null,
  p_note text default null,
  p_remind_days int default 3,
  p_recurring boolean default false,
  p_installments int default null,
  p_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_open int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- A plan needs its per-installment amount, and it IS the monthly cadence
  -- — the open-ended recurring flag never applies to it.
  if p_installments is not null and p_amount_azn is null then
    raise exception 'installment plan requires an amount';
  end if;

  if p_id is null then
    select count(*) into v_open
      from public.personal_debts
     where user_id = v_uid and paid_at is null;
    if v_open >= 50 then
      raise exception 'too many open debts';
    end if;
    insert into public.personal_debts
      (user_id, title, amount_azn, due_date, note, remind_days_before,
       recurring_monthly, installments_total)
    values
      (v_uid, btrim(p_title), p_amount_azn, p_due_date,
       nullif(btrim(coalesce(p_note, '')), ''),
       coalesce(p_remind_days, 3),
       case when p_installments is not null then false
            else coalesce(p_recurring, false) end,
       p_installments)
    returning id into v_id;
  else
    update public.personal_debts
       set title = btrim(p_title),
           amount_azn = p_amount_azn,
           due_date = p_due_date,
           note = nullif(btrim(coalesce(p_note, '')), ''),
           remind_days_before = coalesce(p_remind_days, 3),
           recurring_monthly = case when p_installments is not null then false
                                    else coalesce(p_recurring, false) end,
           installments_total = p_installments
     where id = p_id and user_id = v_uid
     returning id into v_id;
    if v_id is null then
      raise exception 'not found' using errcode = '42501';
    end if;
  end if;

  return json_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.save_personal_debt(text, date, numeric, text, int, boolean, int, uuid) from public, anon;
grant execute on function public.save_personal_debt(text, date, numeric, text, int, boolean, int, uuid) to authenticated;

create or replace function public.set_personal_debt_paid(
  p_id uuid,
  p_paid boolean default true
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.personal_debts%rowtype;
  v_today date := (now() at time zone 'Asia/Baku')::date;
  v_due date;
  v_paid int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_row
    from public.personal_debts
   where id = p_id and user_id = v_uid;
  if v_row.id is null then
    raise exception 'not found' using errcode = '42501';
  end if;

  if p_paid and v_row.installments_total is not null then
    v_paid := v_row.installments_paid + 1;
    if v_paid >= v_row.installments_total then
      update public.personal_debts
         set installments_paid = v_paid, paid_at = now()
       where id = p_id;
    else
      update public.personal_debts
         set installments_paid = v_paid,
             due_date = (v_row.due_date + interval '1 month')::date,
             paid_at = null
       where id = p_id;
    end if;
  elsif p_paid and v_row.recurring_monthly then
    v_due := v_row.due_date;
    loop
      v_due := (v_due + interval '1 month')::date;
      exit when v_due > v_today;
    end loop;
    update public.personal_debts
       set due_date = v_due, paid_at = null
     where id = p_id;
  else
    update public.personal_debts
       set paid_at = case when p_paid then now() else null end
     where id = p_id;
  end if;

  delete from public.notifications
   where user_id = v_uid
     and kind = 'personal_debt'
     and dedupe_key = v_uid::text || ':pdebt:' || p_id::text;

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.set_personal_debt_paid(uuid, boolean) from public, anon;
grant execute on function public.set_personal_debt_paid(uuid, boolean) to authenticated;

-- Reminder body gains the plan position ("taksit 3/6").
create or replace function public.sync_personal_debt_reminders(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_secret text;
  v_today date := (now() at time zone 'Asia/Baku')::date;
  v_keys text[] := array[]::text[];
  v_active int := 0;
  v_deleted int;
  v_pushes jsonb := '[]'::jsonb;
  r record;
  v_body text;
  v_days int;
  v_inserted boolean;
  v_subs jsonb;
  v_unread int;
begin
  select value into v_secret
    from private.app_secrets
   where name = 'payment_reminder_secret';
  if v_secret is null or p_secret is null or p_secret <> v_secret then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  for r in
    select d.id, d.user_id, d.title, d.amount_azn, d.due_date,
           d.installments_total, d.installments_paid
      from public.personal_debts d
     where d.paid_at is null
       and v_today >= d.due_date - d.remind_days_before
     order by d.user_id, d.due_date
  loop
    v_days := r.due_date - v_today;
    v_body := '«' || r.title || '»'
      || case when r.amount_azn is not null
           then ' — ' || trim(trailing '.' from to_char(r.amount_azn, 'FM999999990.99')) || ' ₼' else '' end
      || case when r.installments_total is not null
           then ' · taksit ' || (r.installments_paid + 1) || '/' || r.installments_total else '' end
      || ' · son tarix ' || to_char(r.due_date, 'DD.MM.YYYY')
      || ' · ' || case
           when v_days > 0 then v_days || ' gün qalıb'
           when v_days = 0 then 'bu gün'
           else (-v_days) || ' gün gecikib'
         end;

    insert into public.notifications (user_id, kind, title, body, dedupe_key, read, created_at)
    values (r.user_id, 'personal_debt', 'Borc xatırlatması', v_body,
            r.user_id::text || ':pdebt:' || r.id::text, false, now())
    on conflict (dedupe_key) do update
      set title = excluded.title,
          body = excluded.body,
          read = false,
          created_at = now()
    returning (xmax = 0) into v_inserted;

    v_keys := v_keys || (r.user_id::text || ':pdebt:' || r.id::text);
    v_active := v_active + 1;

    if v_inserted then
      select coalesce(jsonb_agg(jsonb_build_object(
               'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]'::jsonb)
        into v_subs
        from public.push_subscriptions s
       where s.user_id = r.user_id;
      if jsonb_array_length(v_subs) > 0 then
        select count(*) into v_unread
          from public.notifications
         where user_id = r.user_id and read = false;
        v_pushes := v_pushes || jsonb_build_object(
          'subs', v_subs,
          'title', 'Borc xatırlatması',
          'body', v_body,
          'unread', v_unread);
      end if;
    end if;
  end loop;

  with del as (
    delete from public.notifications
     where kind = 'personal_debt'
       and not (dedupe_key = any(v_keys))
     returning 1
  )
  select count(*) into v_deleted from del;

  return jsonb_build_object(
    'active', v_active,
    'deleted', v_deleted,
    'pushes', v_pushes
  );
end;
$$;

revoke all on function public.sync_personal_debt_reminders(text) from public;
grant execute on function public.sync_personal_debt_reminders(text) to anon, authenticated;
