-- Plaid integration.
--
-- plaid_items holds one row per connected bank login (a Plaid "Item"). Plaid
-- limits how many Items we can have, so we never delete-and-recreate them:
-- expired logins are repaired in place through Plaid's "update mode".
--
-- The access token is stored encrypted and is unreadable from the browser:
-- the app's signed-in role can only select the non-secret columns below.

create table public.plaid_items (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  plaid_item_id       text not null unique,
  institution_id      text,
  institution_name    text,
  -- AES-256-GCM ciphertext (see src/lib/crypto.ts). Server-only.
  access_token_enc    text not null,
  -- Where the next /transactions/sync call resumes.
  transactions_cursor text,
  status              text not null default 'good'
                      check (status in ('good', 'needs_reauth', 'error')),
  last_synced_at      timestamptz,
  last_error          text,
  created_at          timestamptz not null default now()
);

create index plaid_items_user_idx on public.plaid_items (user_id);

alter table public.plaid_items enable row level security;

create policy "read own plaid items" on public.plaid_items
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Only the server (service role) may write, and the token column is never
-- selectable by signed-in users.
revoke all on public.plaid_items from anon, authenticated;
grant select (id, user_id, institution_id, institution_name, status, last_synced_at, last_error, created_at)
  on public.plaid_items to authenticated;

-- ------------------------------------------------- link accounts/transactions
alter table public.accounts
  add column plaid_item_id    uuid references public.plaid_items (id) on delete cascade,
  add column plaid_account_id text,
  add column mask             text,
  add constraint accounts_plaid_unique unique (plaid_item_id, plaid_account_id);

alter table public.transactions
  add column merchant       text,
  -- Plaid's detailed category, kept raw so we can map it to our own categories.
  add column plaid_category text;
