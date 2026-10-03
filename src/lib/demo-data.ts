import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Sample transactions for the public demo account, so whatever month a visitor
 * opens it in has something to look at. The daily job fills in the current
 * month up to today (and finishes last month, in case a run was missed).
 *
 * Every row gets a stable external_id, so re-running is a no-op and a row a
 * visitor deleted comes back the next day.
 */

type DemoAccount = "checking" | "credit";

type DemoRow = {
  day: number;
  description: string;
  merchant: string;
  amount: number; // signed: negative = money out
  category: string;
  account: DemoAccount;
};

const ACCOUNT_NAMES: Record<DemoAccount, string> = {
  checking: "Demo Checking",
  credit: "Demo Credit Card",
};

// The same routine every month.
const MONTHLY: DemoRow[] = [
  { day: 1, description: "Paycheck", merchant: "Acme Corp Payroll", amount: 2850, category: "Income", account: "checking" },
  { day: 1, description: "Rent Payment", merchant: "Skyline Apartments", amount: -1800, category: "Rent", account: "checking" },
  { day: 2, description: "Netflix", merchant: "Netflix", amount: -15.99, category: "Bills & Subscriptions", account: "credit" },
  { day: 2, description: "Blue Bottle Coffee", merchant: "Blue Bottle Coffee", amount: -6.75, category: "Food & Drink", account: "credit" },
  { day: 3, description: "Electric & Gas", merchant: "City Utilities", amount: -118.42, category: "Utilities", account: "checking" },
  { day: 4, description: "Trader Joe's", merchant: "Trader Joe's", amount: -62.14, category: "Groceries", account: "credit" },
  { day: 5, description: "Transfer to Vanguard", merchant: "Vanguard", amount: -500, category: "Investments", account: "checking" },
  { day: 5, description: "Chipotle", merchant: "Chipotle", amount: -13.4, category: "Food & Drink", account: "credit" },
  { day: 6, description: "Spotify", merchant: "Spotify", amount: -11.99, category: "Bills & Subscriptions", account: "credit" },
  { day: 7, description: "Uber", merchant: "Uber", amount: -18.4, category: "Transportation", account: "credit" },
  { day: 8, description: "Pike Place Bakery", merchant: "Pike Place Bakery", amount: -9.2, category: "Food & Drink", account: "credit" },
  { day: 10, description: "Gym Membership", merchant: "Gym Membership", amount: -85, category: "Bills & Subscriptions", account: "credit" },
  { day: 10, description: "Whole Foods", merchant: "Whole Foods", amount: -88.4, category: "Groceries", account: "credit" },
  { day: 11, description: "Ramen Danbo", merchant: "Ramen Danbo", amount: -24.5, category: "Food & Drink", account: "credit" },
  { day: 12, description: "Lyft", merchant: "Lyft", amount: -14.2, category: "Transportation", account: "credit" },
  { day: 12, description: "AMC Theatres", merchant: "AMC Theatres", amount: -19, category: "Entertainment & Activities", account: "credit" },
  { day: 14, description: "Din Tai Fung", merchant: "Din Tai Fung", amount: -46.8, category: "Food & Drink", account: "credit" },
  { day: 15, description: "Paycheck", merchant: "Acme Corp Payroll", amount: 2850, category: "Income", account: "checking" },
  { day: 16, description: "Safeway", merchant: "Safeway", amount: -54.2, category: "Groceries", account: "credit" },
  { day: 17, description: "Local Coffee Co", merchant: "Local Coffee Co", amount: -5.5, category: "Food & Drink", account: "credit" },
  { day: 17, description: "Chevron Gas", merchant: "Chevron", amount: -52, category: "Transportation", account: "credit" },
  { day: 20, description: "Thai Basil", merchant: "Thai Basil", amount: -32.1, category: "Food & Drink", account: "credit" },
  { day: 20, description: "Steam", merchant: "Steam", amount: -29.99, category: "Entertainment & Activities", account: "credit" },
  { day: 22, description: "Trader Joe's", merchant: "Trader Joe's", amount: -41.75, category: "Groceries", account: "credit" },
  { day: 22, description: "Metro Transit", merchant: "Metro Transit", amount: -3, category: "Transportation", account: "credit" },
  { day: 23, description: "Pizza Nova", merchant: "Pizza Nova", amount: -28, category: "Food & Drink", account: "credit" },
];

// A couple of one-offs per month, rotated so months don't look identical.
const EXTRAS: DemoRow[][] = [
  [
    { day: 9, description: "Uniqlo", merchant: "Uniqlo", amount: -74.9, category: "Clothing", account: "credit" },
    { day: 25, description: "Pharmacy", merchant: "Walgreens", amount: -23.6, category: "Health & Wellbeing", account: "credit" },
  ],
  [
    { day: 13, description: "Concert Tickets", merchant: "Ticketmaster", amount: -95, category: "Entertainment & Activities", account: "credit" },
    { day: 27, description: "Target", merchant: "Target", amount: -67.3, category: "Household & Living", account: "credit" },
  ],
  [
    { day: 8, description: "Birthday Gift", merchant: "Etsy", amount: -42, category: "Gifts", account: "credit" },
    { day: 18, description: "Dinner with friends", merchant: "Dinner with friends", amount: -110, category: "Food & Drink", account: "credit" },
  ],
  [
    { day: 11, description: "Sephora", merchant: "Sephora", amount: -38.5, category: "Beauty, Bath & Skincare", account: "credit" },
    { day: 24, description: "Apple Store", merchant: "Apple", amount: -149, category: "Technology", account: "credit" },
  ],
  [
    { day: 19, description: "REI", merchant: "REI", amount: -58.25, category: "Hobbies & Interests", account: "credit" },
    { day: 26, description: "Dentist Copay", merchant: "Dentist Copay", amount: -60, category: "Health & Wellbeing", account: "checking" },
  ],
];

export type DemoTransaction = Omit<DemoRow, "day"> & {
  posted_date: string; // YYYY-MM-DD
  external_id: string;
};

// Months before this were entered by hand, without external ids, so
// generating them would add duplicates.
const FIRST_GENERATED_MONTH = "2026-10";

/** "2026-10" -> "2026-09". */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

function daysIn(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * The demo transactions for `month` ("YYYY-MM"), up to and including
 * `throughDay` (default: the whole month).
 */
export function demoTransactionsForMonth(
  month: string,
  throughDay = 31,
): DemoTransaction[] {
  const [y, m] = month.split("-").map(Number);
  const extras = EXTRAS[(y * 12 + m) % EXTRAS.length];
  const last = Math.min(throughDay, daysIn(month));
  const seen = new Map<string, number>();

  return [...MONTHLY, ...extras]
    .filter((r) => r.day <= last)
    .sort((a, b) => a.day - b.day)
    .map(({ day, ...rest }) => {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      // Same merchant twice on one day would collide, so number repeats.
      const base = `demo:${date}:${rest.description.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      return {
        ...rest,
        posted_date: date,
        external_id: n === 1 ? base : `${base}-${n}`,
      };
    });
}

/** Demo transactions for last month, plus this month through `today` (UTC). */
export function demoTransactionsThrough(today: Date): DemoTransaction[] {
  const month = today.toISOString().slice(0, 7);
  return [
    ...demoTransactionsForMonth(previousMonth(month)),
    ...demoTransactionsForMonth(month, today.getUTCDate()),
  ].filter((t) => t.posted_date >= FIRST_GENERATED_MONTH);
}

async function findUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < 1000) return null;
  }
}

/**
 * Adds any missing demo transactions up to `today`. Does nothing if no demo
 * account is configured. Rows whose account or category the demo account no
 * longer has are skipped. Returns how many rows were inserted.
 */
export async function topUpDemoAccount(
  admin: SupabaseClient,
  today = new Date(),
): Promise<number> {
  const email = process.env.DEMO_ACCOUNT_EMAIL?.trim().toLowerCase();
  if (!email) return 0;
  const userId = await findUserIdByEmail(admin, email);
  if (!userId) return 0;

  const [accounts, categories] = await Promise.all([
    admin.from("accounts").select("id, name").eq("user_id", userId),
    admin.from("categories").select("id, name").eq("user_id", userId),
  ]);
  if (accounts.error) throw accounts.error;
  if (categories.error) throw categories.error;
  const accountId = new Map(accounts.data.map((a) => [a.name, a.id as string]));
  const categoryId = new Map(categories.data.map((c) => [c.name, c.id as string]));

  const rows = demoTransactionsThrough(today).flatMap((t) => {
    const account = accountId.get(ACCOUNT_NAMES[t.account]);
    const category = categoryId.get(t.category);
    if (!account || !category) return [];
    return [
      {
        user_id: userId,
        account_id: account,
        category_id: category,
        category_source: "user",
        posted_date: t.posted_date,
        description: t.description,
        merchant: t.merchant,
        amount: t.amount,
        external_id: t.external_id,
        source: "manual",
      },
    ];
  });
  if (rows.length === 0) return 0;

  const { data, error } = await admin
    .from("transactions")
    .upsert(rows, { onConflict: "account_id,external_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  return data.length;
}
