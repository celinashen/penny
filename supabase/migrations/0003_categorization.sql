-- Categorization support.

-- Where a transaction's category came from, so automatic re-categorizing never
-- overrides something you set yourself.
--   auto:   best guess from keywords / Plaid's category
--   rule:   applied from a merchant rule you taught the app
--   user:   you picked it on the transaction
--   import: taken from a CSV column
alter table public.transactions
  add column category_source text not null default 'auto'
    check (category_source in ('auto', 'rule', 'user', 'import')),
  -- ISO 3166 alpha-2 country the purchase was made in, when known.
  add column country text;

-- "Whenever the merchant looks like X, use category Y". Created when you change
-- a category, and applied to future (and matching existing) transactions.
create table public.merchant_rules (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  merchant_key text not null,
  category_id  uuid not null references public.categories (id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (user_id, merchant_key)
);

alter table public.merchant_rules enable row level security;

create policy "own merchant rules" on public.merchant_rules
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.categories c
      where c.id = category_id and c.user_id = (select auth.uid())
    )
  );
