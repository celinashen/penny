-- Penny: initial schema.
-- Every user-owned table carries user_id and is locked down with row-level
-- security, so each person only ever sees their own rows.
--
-- Amount convention: signed from the user's point of view.
--   negative = money out (spending), positive = money in (income, refunds).
-- Currencies are never mixed: each account has a single currency.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- categories
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  -- expense: counts toward spending; income: counts toward income;
  -- transfer: card payments / moves between own accounts, excluded from both.
  kind        text not null default 'expense' check (kind in ('expense', 'income', 'transfer')),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- -------------------------------------------------------------------- accounts
create table public.accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  institution text,
  type        text not null check (type in ('checking', 'savings', 'credit', 'investment', 'other')),
  currency    text not null default 'USD' check (currency in ('USD', 'CAD')),
  -- how data gets in: automatic bank sync, CSV upload, or typed by hand.
  source      text not null default 'manual' check (source in ('plaid', 'csv', 'manual')),
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------------------------------------------------------------- transactions
create table public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id   uuid not null references public.accounts (id) on delete cascade,
  category_id  uuid references public.categories (id) on delete set null,
  posted_date  date not null,
  description  text not null,
  amount       numeric(14, 2) not null,
  pending      boolean not null default false,
  notes        text,
  -- Plaid transaction_id, or a hash of the row for CSV imports. Together with
  -- account_id it makes re-imports and repeated syncs idempotent.
  external_id  text,
  source       text not null default 'manual' check (source in ('plaid', 'csv', 'manual')),
  created_at   timestamptz not null default now(),
  unique (account_id, external_id)
);

create index transactions_user_date_idx on public.transactions (user_id, posted_date desc);
create index transactions_user_category_idx on public.transactions (user_id, category_id);
create index transactions_account_idx on public.transactions (account_id);

-- -------------------------------------------------------------------- holdings
-- One row per security held in an investment account.
create table public.holdings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id  uuid not null references public.accounts (id) on delete cascade,
  ticker      text not null,
  quantity    numeric(20, 8) not null,
  -- total amount paid for the whole position (not per share), in the account currency.
  cost_basis  numeric(14, 2) not null,
  updated_at  timestamptz not null default now(),
  unique (account_id, ticker)
);

create index holdings_user_idx on public.holdings (user_id);

-- ------------------------------------------------------------- security_prices
-- Shared market data, refreshed by the daily job. Not user-owned.
create table public.security_prices (
  ticker      text primary key,
  price       numeric(14, 4) not null,
  currency    text not null default 'USD' check (currency in ('USD', 'CAD')),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------------ RLS
alter table public.categories      enable row level security;
alter table public.accounts        enable row level security;
alter table public.transactions    enable row level security;
alter table public.holdings        enable row level security;
alter table public.security_prices enable row level security;

create policy "own categories" on public.categories
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own accounts" on public.accounts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Writes must also reference an account/category that belongs to the same user,
-- so nobody can attach a row to someone else's data by guessing an id.
create policy "own transactions" on public.transactions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = (select auth.uid())
    )
    and (
      category_id is null
      or exists (
        select 1 from public.categories c
        where c.id = category_id and c.user_id = (select auth.uid())
      )
    )
  );

create policy "own holdings" on public.holdings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = (select auth.uid())
    )
  );

-- Prices are readable by any signed-in user and writable only by the server
-- (service role bypasses RLS), so there is deliberately no write policy.
create policy "read prices" on public.security_prices
  for select to authenticated
  using (true);

-- --------------------------------------------------- default categories per user
create or replace function public.seed_default_categories(target_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.categories (user_id, name, kind, sort_order)
  select target_user, c.name, c.kind, c.sort_order
  from (values
    ('Beauty, Bath & Skincare',    'expense',  1),
    ('Bills & Subscriptions',      'expense',  2),
    ('Clothing',                   'expense',  3),
    ('Entertainment & Activities', 'expense',  4),
    ('Food & Drink',               'expense',  5),
    ('Gifts',                      'expense',  6),
    ('Groceries',                  'expense',  7),
    ('Health & Wellbeing',         'expense',  8),
    ('Hobbies & Interests',        'expense',  9),
    ('Household & Living',         'expense', 10),
    ('Investments',                'expense', 11),
    ('Rent',                       'expense', 12),
    ('Technology',                 'expense', 13),
    ('Transportation',             'expense', 14),
    ('Travel',                     'expense', 15),
    ('Utilities',                  'expense', 16),
    ('Other',                      'expense', 17),
    ('Income',                     'income',  18),
    ('Transfer',                   'transfer', 19)
  ) as c (name, kind, sort_order)
  on conflict (user_id, name) do nothing;
$$;

-- Callable only by the trigger below and by the server, never from the browser.
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill anyone who signed up before this migration ran (idempotent).
select public.seed_default_categories(id) from auth.users;
