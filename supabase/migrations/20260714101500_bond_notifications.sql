-- ============================================================
-- Bond trade notifications: mirror the share-trade triggers with
-- istiqraz wording. Reuses the existing 'match' / 'settled' kinds,
-- so the notifications.kind check constraint is untouched.
-- ============================================================

create or replace function public.tg_bond_trade_notify_insert()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_admin  uuid := public.fund_admin_user_id();
  v_series text;
  v_price  text := to_char(NEW.price, 'FM999990.00');
begin
  select name into v_series from public.bond_series where id = NEW.series_id;

  if NEW.buyer_user_id is not null then
    insert into public.notifications(user_id, kind, trade_id, title, body)
    values (NEW.buyer_user_id, 'match', NEW.id, 'İstiqraz sifarişiniz uyğunlaşdı',
      format('Aldınız %s istiqraz (%s), %s ₼. İsmayıl ilə hesablaşma gözlənilir.', NEW.units, v_series, v_price));
  end if;
  if NEW.seller_user_id is not null then
    insert into public.notifications(user_id, kind, trade_id, title, body)
    values (NEW.seller_user_id, 'match', NEW.id, 'İstiqraz sifarişiniz uyğunlaşdı',
      format('Satdınız %s istiqraz (%s), %s ₼. İsmayıl ilə hesablaşma gözlənilir.', NEW.units, v_series, v_price));
  end if;
  if v_admin is not null
     and v_admin is distinct from NEW.buyer_user_id
     and v_admin is distinct from NEW.seller_user_id then
    insert into public.notifications(user_id, kind, trade_id, title, body)
    values (v_admin, 'match', NEW.id, 'Yeni istiqraz uyğunlaşması — təsdiq gözlənilir',
      format('%s → %s: %s istiqraz (%s), %s ₼.', NEW.seller_name, NEW.buyer_name, NEW.units, v_series, v_price));
  end if;
  return NEW;
end; $$;

drop trigger if exists bond_trade_notify_insert on public.bond_trades;
create trigger bond_trade_notify_insert after insert on public.bond_trades
  for each row execute function public.tg_bond_trade_notify_insert();

create or replace function public.tg_bond_trade_notify_settle()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_series text;
  v_price  text := to_char(NEW.price, 'FM999990.00');
begin
  if NEW.status = 'settled' and OLD.status is distinct from 'settled' then
    select name into v_series from public.bond_series where id = NEW.series_id;
    if NEW.buyer_user_id is not null then
      insert into public.notifications(user_id, kind, trade_id, title, body)
      values (NEW.buyer_user_id, 'settled', NEW.id, 'İstiqraz sifarişi tamamlandı',
        format('Alış tamamlandı: %s istiqraz (%s), %s ₼.', NEW.units, v_series, v_price));
    end if;
    if NEW.seller_user_id is not null then
      insert into public.notifications(user_id, kind, trade_id, title, body)
      values (NEW.seller_user_id, 'settled', NEW.id, 'İstiqraz sifarişi tamamlandı',
        format('Satış tamamlandı: %s istiqraz (%s), %s ₼.', NEW.units, v_series, v_price));
    end if;
  end if;
  return NEW;
end; $$;

drop trigger if exists bond_trade_notify_settle on public.bond_trades;
create trigger bond_trade_notify_settle after update on public.bond_trades
  for each row execute function public.tg_bond_trade_notify_settle();

-- Trigger functions must not be callable as PostgREST RPCs.
revoke execute on function public.tg_bond_trade_notify_insert() from public, anon, authenticated;
revoke execute on function public.tg_bond_trade_notify_settle() from public, anon, authenticated;
