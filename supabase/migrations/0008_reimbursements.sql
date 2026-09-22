-- Reimbursements link an incoming payment (Zelle, Venmo, e-transfer, etc.)
-- to the expense it reimbursed. The incoming transaction remains visible, but
-- reporting applies its amount to the linked expense instead of income.

create table public.transaction_reimbursements (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reimbursement_transaction_id uuid not null references public.transactions (id) on delete cascade,
  expense_transaction_id     uuid not null references public.transactions (id) on delete cascade,
  amount                     numeric(14, 2) not null check (amount > 0),
  created_at                 timestamptz not null default now(),
  unique (reimbursement_transaction_id),
  check (reimbursement_transaction_id <> expense_transaction_id)
);

create index transaction_reimbursements_expense_idx
  on public.transaction_reimbursements (expense_transaction_id);

alter table public.transaction_reimbursements enable row level security;

create policy "own transaction reimbursements"
  on public.transaction_reimbursements
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.transactions t
      where t.id = reimbursement_transaction_id
        and t.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.transactions t
      where t.id = expense_transaction_id
        and t.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.transactions t
      where t.id = reimbursement_transaction_id
        and t.user_id = (select auth.uid())
        and t.amount > 0
    )
    and exists (
      select 1 from public.transactions t
      where t.id = expense_transaction_id
        and t.user_id = (select auth.uid())
        and t.amount < 0
    )
  );

create or replace function public.validate_transaction_reimbursement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reimbursement_amount numeric;
  expense_amount numeric;
  expense_kind text;
  already_linked numeric;
begin
  select amount into reimbursement_amount
  from public.transactions
  where id = new.reimbursement_transaction_id
    and user_id = new.user_id;
  select t.amount, c.kind
    into expense_amount, expense_kind
  from public.transactions t
  left join public.categories c on c.id = t.category_id
  where t.id = new.expense_transaction_id
    and t.user_id = new.user_id;

  if reimbursement_amount is null or reimbursement_amount <= 0
     or expense_amount is null or expense_amount >= 0
     or expense_kind <> 'expense' then
    raise exception 'A reimbursement must link an inflow to an expense';
  end if;

  select coalesce(sum(amount), 0) into already_linked
  from public.transaction_reimbursements
  where expense_transaction_id = new.expense_transaction_id
    and id <> coalesce(new.id, gen_random_uuid());

  if new.amount > reimbursement_amount
     or already_linked + new.amount > abs(expense_amount) then
    raise exception 'A reimbursement cannot exceed the payment or expense';
  end if;
  return new;
end;
$$;

create trigger validate_transaction_reimbursement
  before insert or update on public.transaction_reimbursements
  for each row execute function public.validate_transaction_reimbursement();

revoke execute on function public.validate_transaction_reimbursement() from public, anon, authenticated;

-- Keep all summary surfaces consistent: linked money-in is removed from its
-- original category and added to the target expense on the target's date.
drop function if exists public.spending_by_month(date, date, integer);

create function public.spending_by_month(p_from date, p_to date, p_day integer default 31)
returns table (
  month text, currency text, category_id uuid, category_name text, kind text,
  outflow boolean, total numeric, through_day numeric, txns bigint
)
language sql stable security invoker set search_path = ''
as $$
  with reimbursements as (
    select expense_transaction_id, sum(amount) as amount
    from public.transaction_reimbursements
    group by expense_transaction_id
  )
  select
    to_char(t.posted_date, 'YYYY-MM')::text as month,
    a.currency,
    c.id,
    c.name,
    c.kind,
    (t.amount + coalesce(r.amount, 0) < 0) as outflow,
    sum(t.amount + coalesce(r.amount, 0)) as total,
    coalesce(sum(t.amount + coalesce(r.amount, 0))
      filter (where extract(day from t.posted_date) <= p_day), 0) as through_day,
    count(*) as txns
  from public.transactions t
  join public.accounts a on a.id = t.account_id
  left join public.categories c on c.id = t.category_id
  left join reimbursements r on r.expense_transaction_id = t.id
  where t.posted_date >= p_from
    and t.posted_date < p_to
    and not exists (
      select 1 from public.transaction_reimbursements tr
      where tr.reimbursement_transaction_id = t.id
    )
  group by 1, 2, 3, 4, 5, 6
  order by 1, 2, 3 nulls first, 6
$$;

revoke execute on function public.spending_by_month(date, date, integer) from public, anon;
grant execute on function public.spending_by_month(date, date, integer) to authenticated;

create or replace function public.spending_daily(p_from date, p_to date)
returns table (day date, currency text, total numeric)
language sql stable security invoker set search_path = ''
as $$
  with reimbursements as (
    select expense_transaction_id, sum(amount) as amount
    from public.transaction_reimbursements
    group by expense_transaction_id
  )
  select t.posted_date, a.currency, sum(-(t.amount + coalesce(r.amount, 0)))
  from public.transactions t
  join public.accounts a on a.id = t.account_id
  left join public.categories c on c.id = t.category_id
  left join reimbursements r on r.expense_transaction_id = t.id
  where t.posted_date >= p_from and t.posted_date < p_to
    and (c.kind = 'expense' or (c.kind is null and t.amount < 0))
    and not exists (
      select 1 from public.transaction_reimbursements tr
      where tr.reimbursement_transaction_id = t.id
    )
  group by 1, 2
  order by 1, 2
$$;

create or replace function public.top_merchants(
  p_from date, p_to date, p_limit integer default 5
)
returns table (currency text, name text, total numeric, txns bigint)
language sql stable security invoker set search_path = ''
as $$
  with reimbursements as (
    select expense_transaction_id, sum(amount) as amount
    from public.transaction_reimbursements
    group by expense_transaction_id
  ),
  spend as (
    select a.currency,
      coalesce(nullif(btrim(t.merchant), ''), t.description) as label,
      -(t.amount + coalesce(r.amount, 0)) as spent
    from public.transactions t
    join public.accounts a on a.id = t.account_id
    left join public.categories c on c.id = t.category_id
    left join reimbursements r on r.expense_transaction_id = t.id
    where t.posted_date >= p_from and t.posted_date < p_to
      and t.amount + coalesce(r.amount, 0) < 0
      and (c.kind is null or c.kind = 'expense')
      and not exists (
        select 1 from public.transaction_reimbursements tr
        where tr.reimbursement_transaction_id = t.id
      )
  ),
  keyed as (
    select currency, label, spent,
      coalesce(nullif(array_to_string((regexp_split_to_array(
        btrim(regexp_replace(lower(label), '\([^)]*\)|[^a-z]+', ' ', 'g')),
        '\s+'))[1:3], ' '), ''), lower(label)) as key
    from spend
  ),
  grouped as (
    select currency, key, (array_agg(label order by spent desc))[1] as name,
      sum(spent) as total, count(*) as txns
    from keyed group by currency, key
  ),
  ranked as (
    select *, row_number() over (partition by currency order by total desc, key) as rn
    from grouped
  )
  select currency, name, total, txns
  from ranked where rn <= p_limit
  order by currency, total desc
$$;

create or replace function public.largest_purchases(
  p_from date, p_to date, p_limit integer default 5
)
returns table (currency text, posted_date date, name text, amount numeric)
language sql stable security invoker set search_path = ''
as $$
  with reimbursements as (
    select expense_transaction_id, sum(amount) as amount
    from public.transaction_reimbursements
    group by expense_transaction_id
  ),
  spend as (
    select a.currency, t.posted_date,
      coalesce(nullif(btrim(t.merchant), ''), t.description) as name,
      t.amount + coalesce(r.amount, 0) as amount,
      row_number() over (
        partition by a.currency
        order by t.amount + coalesce(r.amount, 0), t.id
      ) as rn
    from public.transactions t
    join public.accounts a on a.id = t.account_id
    left join public.categories c on c.id = t.category_id
    left join reimbursements r on r.expense_transaction_id = t.id
    where t.posted_date >= p_from and t.posted_date < p_to
      and t.amount + coalesce(r.amount, 0) < 0
      and (c.kind is null or c.kind = 'expense')
      and not exists (
        select 1 from public.transaction_reimbursements tr
        where tr.reimbursement_transaction_id = t.id
      )
  )
  select currency, posted_date, name, amount
  from spend where rn <= p_limit
  order by currency, rn
$$;

revoke execute on function public.spending_daily(date, date) from public, anon;
revoke execute on function public.top_merchants(date, date, integer) from public, anon;
revoke execute on function public.largest_purchases(date, date, integer) from public, anon;
grant execute on function public.spending_daily(date, date) to authenticated;
grant execute on function public.top_merchants(date, date, integer) to authenticated;
grant execute on function public.largest_purchases(date, date, integer) to authenticated;
