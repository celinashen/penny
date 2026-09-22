import type { Currency } from "./accounts";

/**
 * expense: counts as spending. income: money earned. transfer: moves between
 * your own accounts, ignored. investment: contributions, which are saving and
 * are reported separately from spending.
 */
export type CategoryKind = "expense" | "income" | "transfer" | "investment";

export type Category = {
  id: string;
  name: string;
  kind: CategoryKind;
  sort_order: number;
};

export type Tx = {
  id: string;
  posted_date: string; // YYYY-MM-DD
  description: string;
  merchant: string | null;
  amount: number; // signed: negative = money out
  pending: boolean;
  notes: string | null;
  category_id: string | null;
  category_source: "auto" | "rule" | "user" | "import";
  source: "plaid" | "csv" | "manual";
  account: { id: string; name: string; currency: Currency };
  category: { id: string; name: string; kind: CategoryKind } | null;
  reimbursement?: {
    id: string;
    amount: number;
    expense: {
      id: string;
      posted_date: string;
      description: string;
      merchant: string | null;
      amount: number;
      category: { name: string } | null;
    };
  } | null;
};

export const PAGE_SIZE = 50;

/** "$1,234.50". CAD and USD both use "$"; show the code alongside when it matters. */
export function formatMoney(amount: number, currency: Currency, signed = false) {
  const body = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(Math.abs(amount));
  if (signed && amount > 0) return `+${body}`;
  if (signed && amount < 0) return `−${body}`;
  return body;
}

/** "$1,235": whole dollars, for tables where cents are noise. */
export function formatMoneyWhole(amount: number, currency: Currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** "2026-09" -> { from: "2026-09-01", to: "2026-10-01" } (to is exclusive). */
export function monthRange(month: string | undefined | null) {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month ?? "");
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  const next = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, "0")}`;
  return { from: `${m[1]}-${m[2]}-01`, to: `${next}-01` };
}

/** Adds (or subtracts) whole months to a "YYYY-MM" string. */
export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function currentMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "Thu, Sep 11". Parsed as a local date so it never shifts a day. */
export function formatDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "Sep". */
export function monthShort(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

export function formatMonthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}
