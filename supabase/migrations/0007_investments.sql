-- Investment accounts: holdings, balances, and contributions.
--
-- Holdings and balances come from Plaid's Investments product. Deposits into an
-- investment account are recorded as "flows". For accounts marked
-- payroll_funded, those deposits are treated as money that came out of your
-- paycheck before it reached your bank, so they're added to income and to
-- "contributed to investments" on the Overview.

-- ------------------------------------------------------------------ accounts
alter table public.accounts
  -- Plaid's account subtype, e.g. "401k", "roth", "brokerage", "hsa".
  add column subtype         text,
  -- True when deposits into this account came from your paycheck.
  add column payroll_funded  boolean not null default false,
  -- Current total value (securities plus cash) as last reported by the institution.
  add column balance_current numeric(16, 2),
  add column balance_as_of   timestamptz;

-- ------------------------------------------------------------------ holdings
alter table public.holdings
  alter column ticker     drop not null,
  alter column cost_basis drop not null,
  add column name              text,
  -- Plaid's security type: equity, etf, mutual fund, fixed income, cash, ...
  add column security_type     text,
  add column plaid_security_id text,
  add column price             numeric(16, 4),
  add column market_value      numeric(16, 2),
  add column price_as_of       date,
  add constraint holdings_plaid_unique unique (account_id, plaid_security_id);

-- Hand-entered holdings are still unique per ticker; synced ones are unique per security.
alter table public.holdings drop constraint holdings_account_id_ticker_key;
create unique index holdings_manual_ticker_unique
  on public.holdings (account_id, ticker)
  where plaid_security_id is null and ticker is not null;

-- --------------------------------------------------------------- plaid_items
alter table public.plaid_items
  -- What this connection provides: "transactions", "investments", or both.
  add column products              text[] not null default array['transactions'],
  add column investments_backfilled boolean not null default false,
  add column investments_synced_at  timestamptz;

-- ---------------------------------------------------------- investment_flows
-- Money going into an investment account (contributions and deposits).
create table public.investment_flows (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id  uuid not null references public.accounts (id) on delete cascade,
  posted_date date not null,
  -- Always positive: money into the account.
  amount      numeric(16, 2) not null check (amount > 0),
  description text,
  -- Plaid's type and subtype, e.g. "cash / contribution".
  kind        text,
  -- Plaid's investment_transaction_id, so syncing again never duplicates a row.
  external_id text not null,
  created_at  timestamptz not null default now(),
  unique (account_id, external_id)
);

create index investment_flows_user_date_idx on public.investment_flows (user_id, posted_date desc);

alter table public.investment_flows enable row level security;

create policy "own investment flows" on public.investment_flows
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = (select auth.uid())
    )
  );

-- --------------------------------------------- payroll_contributions_by_month
-- Deposits into accounts you've marked as paycheck-funded, per month and currency.
-- SECURITY INVOKER: runs as the caller, so row-level security still applies.
create function public.payroll_contributions_by_month(p_from date, p_to date)
returns table (month text, currency text, total numeric, txns bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    to_char(f.posted_date, 'YYYY-MM') as month,
    a.currency,
    sum(f.amount) as total,
    count(*)      as txns
  from public.investment_flows f
  join public.accounts a on a.id = f.account_id
  where a.payroll_funded
    and f.posted_date >= p_from
    and f.posted_date <  p_to
  group by 1, 2
  order by 1, 2
$$;

revoke execute on function public.payroll_contributions_by_month(date, date) from public, anon;
grant execute on function public.payroll_contributions_by_month(date, date) to authenticated;
