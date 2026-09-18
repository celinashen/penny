-- Summaries and indexes so pages read a small, fixed amount of data no matter how
-- many transactions you have.
--
-- Every function here is SECURITY INVOKER: it runs with the caller's permissions,
-- so row-level security still limits it to the signed-in user's own rows.

-- --------------------------------------------------------- spending_by_month
-- Same as before, plus `through_day`: how much of each total fell on or before
-- day-of-month `p_day`. Comparing that across past months is what lets the app
-- say "you've usually spent 60% of this category by the 18th".
drop function if exists public.spending_by_month(date, date);

create function public.spending_by_month(p_from date, p_to date, p_day integer default 31)
returns table (
  month         text,
  currency      text,
  category_id   uuid,
  category_name text,
  kind          text,
  outflow       boolean,
  total         numeric,
  through_day   numeric,
  txns          bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    to_char(t.posted_date, 'YYYY-MM') as month,
    a.currency,
    c.id   as category_id,
    c.name as category_name,
    c.kind,
    (t.amount < 0) as outflow,
    sum(t.amount)  as total,
    coalesce(sum(t.amount) filter (where extract(day from t.posted_date) <= p_day), 0) as through_day,
    count(*)       as txns
  from public.transactions t
  join public.accounts a on a.id = t.account_id
  left join public.categories c on c.id = t.category_id
  where t.posted_date >= p_from
    and t.posted_date <  p_to
  group by 1, 2, 3, 4, 5, 6
  -- A fixed order, so the app can safely read the result page by page.
  order by 1, 2, 3 nulls first, 6
$$;

-- ------------------------------------------------------------- spending_daily
-- Spending per day (net of refunds), for the month-to-date pace chart.
create function public.spending_daily(p_from date, p_to date)
returns table (day date, currency text, total numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.posted_date as day, a.currency, sum(-t.amount) as total
  from public.transactions t
  join public.accounts a on a.id = t.account_id
  left join public.categories c on c.id = t.category_id
  where t.posted_date >= p_from
    and t.posted_date <  p_to
    and (c.kind = 'expense' or (c.kind is null and t.amount < 0))
  group by 1, 2
  order by 1, 2
$$;

-- ----------------------------------------------------------- top_merchants
-- Where the most money went, grouping "QFC #5847" and "QFC #1204" together:
-- lowercase, letters only, first three words. (Display grouping only; category
-- rules use the app's own version of this.)
create function public.top_merchants(p_from date, p_to date, p_limit integer default 5)
returns table (currency text, name text, total numeric, txns bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with spend as (
    select
      a.currency,
      coalesce(nullif(btrim(t.merchant), ''), t.description) as label,
      -t.amount as spent
    from public.transactions t
    join public.accounts a on a.id = t.account_id
    left join public.categories c on c.id = t.category_id
    where t.posted_date >= p_from
      and t.posted_date <  p_to
      and t.amount < 0
      and (c.kind is null or c.kind = 'expense')
  ),
  keyed as (
    select
      currency, label, spent,
      coalesce(
        nullif(
          array_to_string(
            (regexp_split_to_array(
               btrim(regexp_replace(lower(label), '\([^)]*\)|[^a-z]+', ' ', 'g')),
               '\s+'
             ))[1:3],
            ' '
          ),
          ''
        ),
        lower(label)
      ) as key
    from spend
  ),
  grouped as (
    select
      currency, key,
      (array_agg(label order by spent desc))[1] as name,
      sum(spent) as total,
      count(*)   as txns
    from keyed
    group by currency, key
  ),
  ranked as (
    select *, row_number() over (partition by currency order by total desc, key) as rn
    from grouped
  )
  select currency, name, total, txns
  from ranked
  where rn <= p_limit
  order by currency, total desc
$$;

-- ------------------------------------------------------- largest_purchases
create function public.largest_purchases(p_from date, p_to date, p_limit integer default 5)
returns table (currency text, posted_date date, name text, amount numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with spend as (
    select
      a.currency,
      t.posted_date,
      coalesce(nullif(btrim(t.merchant), ''), t.description) as name,
      t.amount,
      row_number() over (partition by a.currency order by t.amount asc, t.id) as rn
    from public.transactions t
    join public.accounts a on a.id = t.account_id
    left join public.categories c on c.id = t.category_id
    where t.posted_date >= p_from
      and t.posted_date <  p_to
      and t.amount < 0
      and (c.kind is null or c.kind = 'expense')
  )
  select currency, posted_date, name, amount
  from spend
  where rn <= p_limit
  order by currency, rn
$$;

revoke execute on function public.spending_by_month(date, date, integer) from public, anon;
revoke execute on function public.spending_daily(date, date)             from public, anon;
revoke execute on function public.top_merchants(date, date, integer)     from public, anon;
revoke execute on function public.largest_purchases(date, date, integer) from public, anon;
grant execute on function public.spending_by_month(date, date, integer) to authenticated;
grant execute on function public.spending_daily(date, date)             to authenticated;
grant execute on function public.top_merchants(date, date, integer)     to authenticated;
grant execute on function public.largest_purchases(date, date, integer) to authenticated;

-- ------------------------------------------------------------------- indexes
-- Searching descriptions with ILIKE '%text%' can't use a normal index; trigram
-- indexes make it fast even on a very large table.
create extension if not exists pg_trgm with schema extensions;

create index if not exists transactions_description_trgm
  on public.transactions using gin (description extensions.gin_trgm_ops);
create index if not exists transactions_merchant_trgm
  on public.transactions using gin (merchant extensions.gin_trgm_ops);

-- "This category, this month" (Overview links, the category filter).
create index if not exists transactions_user_category_date_idx
  on public.transactions (user_id, category_id, posted_date desc);
drop index if exists public.transactions_user_category_idx;

-- Counting what still needs a category, on every Transactions page load.
create index if not exists transactions_waiting_idx
  on public.transactions (user_id)
  where category_id is null and category_source = 'auto';

-- The monthly summaries read only these columns, so they can be answered from
-- the index alone without touching the table.
create index if not exists transactions_user_date_cover_idx
  on public.transactions (user_id, posted_date)
  include (amount, account_id, category_id);
