-- Trips group discretionary travel spending together. Attaching a transaction
-- to a trip recategorizes it as Travel (so a meal in Italy counts as travel
-- spending, not Food & Drink) and remembers its old category, so removing it
-- from the trip later can put that back instead of leaving it uncategorized.
--
-- A trip's net cost -- what you actually paid after other people's Zelle/cash
-- settle-ups -- isn't stored: it's the sum of its transactions' amounts (an
-- expense is negative, a reimbursement attached to the same trip is positive
-- and nets against it), computed the same way any other category total is.
create table public.trips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.trips enable row level security;

create policy "own trips" on public.trips
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.transactions
  add column trip_id uuid references public.trips (id) on delete set null,
  -- The category a transaction had right before a trip took it over, so
  -- taking it back out of the trip can restore that instead of guessing.
  add column pre_trip_category_id uuid references public.categories (id) on delete set null;

create index transactions_trip_idx on public.transactions (trip_id) where trip_id is not null;

-- Writing a transaction's trip must reference a trip you own, same pattern as
-- the existing account/category checks in "own transactions".
drop policy "own transactions" on public.transactions;
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
    and (
      trip_id is null
      or exists (
        select 1 from public.trips t
        where t.id = trip_id and t.user_id = (select auth.uid())
      )
    )
  );
