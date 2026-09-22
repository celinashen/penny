-- A simple hand-kept log for an investment account you can't sync (Fidelity,
-- say): just "as of this date, I've put in $X total and it's worth $Y", not
-- individual holdings. One row per check-in, so a history builds over time.
create table public.account_value_snapshots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id  uuid not null references public.accounts (id) on delete cascade,
  as_of       date not null,
  value       numeric(16, 2) not null check (value >= 0),
  -- Cumulative total put in as of this date, not this entry's delta.
  contributed numeric(16, 2) check (contributed >= 0),
  created_at  timestamptz not null default now(),
  unique (account_id, as_of)
);

create index account_value_snapshots_account_idx
  on public.account_value_snapshots (account_id, as_of);

alter table public.account_value_snapshots enable row level security;

create policy "own account value snapshots" on public.account_value_snapshots
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = (select auth.uid())
    )
  );
