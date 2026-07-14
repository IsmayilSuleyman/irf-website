-- ============================================================
-- İsmayılBank product terms: the advertised deposit/credit rate
-- tiers, editable by İsmayıl at any time (admin RPC). These feed
-- the public calculators on /ismayilbank; per-account terms remain
-- in the Google Sheet.
-- Readable by anon because /ismayilbank is a public page.
-- ============================================================
create table if not exists public.bank_product_terms (
  product         text    not null check (product in ('deposit','credit')),
  term_months     int     not null check (term_months between 1 and 120),
  annual_rate_pct numeric not null check (annual_rate_pct >= 0 and annual_rate_pct <= 100),
  updated_at      timestamptz not null default now(),
  primary key (product, term_months)
);

alter table public.bank_product_terms enable row level security;

drop policy if exists "bank_product_terms read" on public.bank_product_terms;
create policy "bank_product_terms read" on public.bank_product_terms
  for select to anon, authenticated using (true);

revoke all on public.bank_product_terms from anon, authenticated;
grant select on public.bank_product_terms to anon, authenticated;

-- Replace the full tier list for one product. Admin only; all-or-nothing
-- so a partial edit can never leave the calculator with a half-updated table.
create or replace function public.admin_set_bank_product_terms(p_product text, p_terms jsonb)
returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count int;
begin
  if not public.is_fund_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_product not in ('deposit','credit') then
    raise exception 'Yanlış məhsul: %', p_product;
  end if;
  if p_terms is null or jsonb_typeof(p_terms) <> 'array' or jsonb_array_length(p_terms) = 0 then
    raise exception 'Ən azı bir müddət/faiz sətri tələb olunur';
  end if;
  if jsonb_array_length(p_terms) > 60 then
    raise exception 'Həddindən çox sətir (maksimum 60)';
  end if;

  delete from public.bank_product_terms where product = p_product;

  insert into public.bank_product_terms (product, term_months, annual_rate_pct, updated_at)
  select p_product, x.term_months, x.annual_rate_pct, now()
  from jsonb_to_recordset(p_terms) as x(term_months int, annual_rate_pct numeric)
  where x.term_months is not null and x.annual_rate_pct is not null;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Heç bir keçərli sətir tapılmadı';
  end if;

  return json_build_object('ok', true, 'product', p_product, 'count', v_count);
end; $$;

revoke execute on function public.admin_set_bank_product_terms(text, jsonb) from public, anon;
grant  execute on function public.admin_set_bank_product_terms(text, jsonb) to authenticated;

-- Seed with the rates previously hardcoded in the calculators
-- (components/IsmayilBankDepositCalculator.tsx / IsmayilBankCalculator.tsx).
insert into public.bank_product_terms (product, term_months, annual_rate_pct) values
  ('deposit',  3, 10),
  ('deposit',  6, 12),
  ('deposit',  9, 14),
  ('deposit', 12, 16),
  ('credit',  1, 0),
  ('credit',  2, 0),
  ('credit',  3, 0),
  ('credit',  4, 0.5),
  ('credit',  5, 1),
  ('credit',  6, 1.5),
  ('credit',  7, 2.15),
  ('credit',  8, 2.9),
  ('credit',  9, 3.9),
  ('credit', 10, 4.9),
  ('credit', 11, 5.9),
  ('credit', 12, 6.9)
on conflict (product, term_months) do nothing;
