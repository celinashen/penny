-- 0007 added `products` to plaid_items but never added it to the column-level
-- grant from 0002, so it's been unreadable by the app (authenticated role)
-- ever since -- selecting it errors instead of just being denied silently.
grant select (products) on public.plaid_items to authenticated;
