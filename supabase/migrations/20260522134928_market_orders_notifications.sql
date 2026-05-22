-- In-app notifications for matched/settled trades (buyer, seller, and İsmayıl).
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  kind       text not null check (kind in ('match','settled')),
  trade_id   uuid,
  title      text not null,
  body       text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx
  on public.notifications (user_id, read, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

drop policy if exists "notifications select own" on public.notifications;
create policy "notifications select own" on public.notifications for select to authenticated
  using (user_id = auth.uid());

-- Resolve İsmayıl's auth user id from the configured principal name (reads
-- auth.users, so SECURITY DEFINER; never exposed to clients).
create or replace function public.fund_admin_user_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select u.id
  from auth.users u, public.fund_config c
  where c.id = 1
    and public.norm(coalesce(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      u.raw_user_meta_data->>'display_name', '')) = public.norm(c.principal_name)
  order by u.created_at
  limit 1
$$;
revoke execute on function public.fund_admin_user_id() from public, anon, authenticated;

-- Caller marks their notifications read (all unread, or a specific set).
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='42501'; end if;
  update public.notifications set read = true
   where user_id = v_uid and read = false
     and (p_ids is null or id = any(p_ids));
  return json_build_object('ok', true);
end; $$;
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant  execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- On a new matched trade: notify both parties + İsmayıl (to settle).
create or replace function public.tg_trade_notify_insert()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_admin uuid := public.fund_admin_user_id();
  v_price text := to_char(NEW.price, 'FM999990.00');
  v_units text := to_char(NEW.units, 'FM999999990.######');
begin
  if NEW.buyer_user_id is not null then
    insert into public.notifications(user_id, kind, trade_id, title, body)
    values (NEW.buyer_user_id, 'match', NEW.id, 'Sifarişiniz uyğunlaşdı',
      format('Aldınız %s pay, %s ₼. İsmayıl ilə hesablaşma gözlənilir.', v_units, v_price));
  end if;
  if NEW.seller_user_id is not null then
    insert into public.notifications(user_id, kind, trade_id, title, body)
    values (NEW.seller_user_id, 'match', NEW.id, 'Sifarişiniz uyğunlaşdı',
      format('Satdınız %s pay, %s ₼. İsmayıl ilə hesablaşma gözlənilir.', v_units, v_price));
  end if;
  if v_admin is not null
     and v_admin is distinct from NEW.buyer_user_id
     and v_admin is distinct from NEW.seller_user_id then
    insert into public.notifications(user_id, kind, trade_id, title, body)
    values (v_admin, 'match', NEW.id, 'Yeni uyğunlaşma — təsdiq gözlənilir',
      format('%s → %s: %s pay, %s ₼.', NEW.seller_name, NEW.buyer_name, v_units, v_price));
  end if;
  return NEW;
end; $$;

drop trigger if exists trade_notify_insert on public.trades;
create trigger trade_notify_insert after insert on public.trades
  for each row execute function public.tg_trade_notify_insert();

-- On settlement: tell both parties the trade is complete.
create or replace function public.tg_trade_notify_settle()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_price text := to_char(NEW.price, 'FM999990.00');
  v_units text := to_char(NEW.units, 'FM999999990.######');
begin
  if NEW.status = 'settled' and OLD.status is distinct from 'settled' then
    if NEW.buyer_user_id is not null then
      insert into public.notifications(user_id, kind, trade_id, title, body)
      values (NEW.buyer_user_id, 'settled', NEW.id, 'Sifariş tamamlandı',
        format('Alış tamamlandı: %s pay, %s ₼.', v_units, v_price));
    end if;
    if NEW.seller_user_id is not null then
      insert into public.notifications(user_id, kind, trade_id, title, body)
      values (NEW.seller_user_id, 'settled', NEW.id, 'Sifariş tamamlandı',
        format('Satış tamamlandı: %s pay, %s ₼.', v_units, v_price));
    end if;
  end if;
  return NEW;
end; $$;

drop trigger if exists trade_notify_settle on public.trades;
create trigger trade_notify_settle after update on public.trades
  for each row execute function public.tg_trade_notify_settle();

-- Trigger functions must not be callable as PostgREST RPCs.
revoke execute on function public.tg_trade_notify_insert() from public, anon, authenticated;
revoke execute on function public.tg_trade_notify_settle() from public, anon, authenticated;