-- Monthly totals per currency and category, for the Overview and Year pages.
--
-- SECURITY INVOKER (the default, stated explicitly): the function runs with the
-- caller's permissions, so row-level security still limits it to the signed-in
-- user's own transactions.
--
-- Rows are also split by direction (outflow = money out). That lets the app
-- treat uncategorized spending and uncategorized money-in differently.
create or replace function public.spending_by_month(p_from date, p_to date)
returns table (
  month         text,
  currency      text,
  category_id   uuid,
  category_name text,
  kind          text,
  outflow       boolean,
  total         numeric,
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
    count(*)       as txns
  from public.transactions t
  join public.accounts a on a.id = t.account_id
  left join public.categories c on c.id = t.category_id
  where t.posted_date >= p_from
    and t.posted_date <  p_to
  group by 1, 2, 3, 4, 5, 6
$$;

revoke execute on function public.spending_by_month(date, date) from public, anon;
grant execute on function public.spending_by_month(date, date) to authenticated;
