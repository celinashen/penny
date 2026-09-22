-- Lets you rename an account and "remove" one you no longer track.
--
-- A synced account can't just be deleted: the next sync would recreate it,
-- since Plaid still reports it as long as the Item stays connected. `hidden`
-- lets the row (and its transaction history) stay put while the app treats
-- it as gone -- no Plaid Item is touched, so hiding or restoring one is free.
alter table public.accounts add column hidden boolean not null default false;
