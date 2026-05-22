-- Trigger functions must not be callable as PostgREST RPCs.
revoke execute on function public.tg_trade_notify_insert() from public, anon, authenticated;
revoke execute on function public.tg_trade_notify_settle() from public, anon, authenticated;
