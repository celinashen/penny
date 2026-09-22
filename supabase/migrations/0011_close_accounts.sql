-- "Closing" an account (any source -- Plaid or manual) keeps its row and
-- history but takes it out of pickers/totals/lists, the same way a real
-- closed credit card still has statements worth keeping around. This is the
-- same mechanism the `hidden` column already gave Plaid accounts; renamed to
-- match the concept, and no longer limited to Plaid-sourced ones.
alter table public.accounts rename column hidden to closed;
