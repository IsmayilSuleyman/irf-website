-- Let a user clear (delete) all of their own notifications.
create or replace function public.clear_my_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  with del as (
    delete from public.notifications where user_id = v_uid returning 1
  )
  select count(*) into v_count from del;
  return v_count;
end;
$$;

revoke execute on function public.clear_my_notifications() from public, anon;
grant execute on function public.clear_my_notifications() to authenticated;
