-- Contributions to investments are saving, not spending, so "Investments" gets
-- its own kind. It's left out of "Spent" and reported separately as "Invested".

alter table public.categories drop constraint categories_kind_check;
alter table public.categories
  add constraint categories_kind_check
  check (kind in ('expense', 'income', 'transfer', 'investment'));

-- Existing users: switch the default Investments category over.
update public.categories
   set kind = 'investment'
 where name = 'Investments' and kind = 'expense';

-- New users get it that way from signup.
create or replace function public.seed_default_categories(target_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.categories (user_id, name, kind, sort_order)
  select target_user, c.name, c.kind, c.sort_order
  from (values
    ('Beauty, Bath & Skincare',    'expense',    1),
    ('Bills & Subscriptions',      'expense',    2),
    ('Clothing',                   'expense',    3),
    ('Entertainment & Activities', 'expense',    4),
    ('Food & Drink',               'expense',    5),
    ('Gifts',                      'expense',    6),
    ('Groceries',                  'expense',    7),
    ('Health & Wellbeing',         'expense',    8),
    ('Hobbies & Interests',        'expense',    9),
    ('Household & Living',         'expense',   10),
    ('Investments',                'investment',11),
    ('Rent',                       'expense',   12),
    ('Technology',                 'expense',   13),
    ('Transportation',             'expense',   14),
    ('Travel',                     'expense',   15),
    ('Utilities',                  'expense',   16),
    ('Other',                      'expense',   17),
    ('Income',                     'income',    18),
    ('Transfer',                   'transfer',  19)
  ) as c (name, kind, sort_order)
  on conflict (user_id, name) do nothing;
$$;

-- Still callable only by the signup trigger and the server, never the browser.
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;
