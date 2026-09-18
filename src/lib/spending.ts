import type { Currency } from "./accounts";
import { shiftMonth, type CategoryKind } from "./transactions";

/** One row of the database's spending_by_month() result. */
export type AggRow = {
  month: string; // YYYY-MM
  currency: Currency;
  category_id: string | null;
  category_name: string | null;
  kind: CategoryKind | null;
  /** True for rows that add up money going out. */
  outflow: boolean;
  total: number; // signed sum: negative = money out
  /** The part of `total` that fell on or before the day-of-month that was asked for. */
  through_day: number;
  txns: number;
};

export type CategorySeries = {
  id: string;
  name: string;
  byMonth: Record<string, number>;
  total: number;
};

/** Deposits into paycheck-funded investment accounts, per month and currency. */
export type FlowRow = { month: string; currency: Currency; total: number };

export type Series = {
  months: string[];
  spent: Record<string, number>;
  /** Paychecks and other income, plus contributions made through payroll. */
  income: Record<string, number>;
  /**
   * The part of `income` (and of `invested`) that was deducted from your paycheck
   * and went straight into investment accounts, so it never reached your bank.
   */
  payroll: Record<string, number>;
  /**
   * Contributed to investments, per month: money moved into investing, net of
   * any withdrawn back out. Not counted as spending.
   */
  invested: Record<string, number>;
  /** Uncategorized money-in, per month: left out of income until reviewed. */
  unreviewed: Record<string, number>;
  /** Spending categories (plus "Uncategorized"), biggest first. */
  categories: CategorySeries[];
};

const round = (n: number) => Math.round(n * 100) / 100;

/** The `count` months ending at `end`, oldest first: ("2026-09", 3) -> Jul, Aug, Sep. */
export function monthsEndingAt(end: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(end, i - (count - 1)));
}

/** January of `end`'s year through `end`. */
export function monthsYearToDate(end: string): string[] {
  const month = Number(end.slice(5, 7));
  return monthsEndingAt(end, month);
}

/**
 * Totals for one currency over a run of months. The rules:
 *  - Transfers (card payments, moves between your accounts) are ignored.
 *  - Spending is money out of expense categories; a refund in the same category
 *    reduces it instead of counting as income.
 *  - Income is money into income categories.
 *  - Investment contributions are saving, so they're tallied as `invested` and
 *    never counted as spending.
 *  - Contributions made through payroll (deposits into paycheck-funded
 *    investment accounts) never passed through your bank, so they're added to
 *    `income` as well as `invested`, giving a truer picture of what you earned.
 *  - Uncategorized spending is grouped as "Uncategorized"; uncategorized money
 *    in is not counted anywhere, only tallied as `unreviewed`.
 */
export function buildSeries(
  rows: AggRow[],
  currency: Currency,
  months: string[],
  payrollRows: FlowRow[] = [],
): Series {
  const wanted = new Set(months);
  const zero = () => Object.fromEntries(months.map((m) => [m, 0])) as Record<string, number>;
  const spent = zero();
  const income = zero();
  const payroll = zero();
  const invested = zero();
  const unreviewed = zero();
  const byCategory = new Map<string, CategorySeries>();

  for (const r of rows) {
    if (r.currency !== currency || !wanted.has(r.month)) continue;
    const amount = Number(r.total);

    if (r.kind === "transfer") continue;
    if (r.kind === "income") {
      income[r.month] += amount;
      continue;
    }
    if (r.kind === "investment") {
      invested[r.month] += -amount;
      continue;
    }

    if (r.category_id === null && !r.outflow) {
      unreviewed[r.month] += Number(r.txns);
      continue;
    }

    const id = r.category_id ?? "uncategorized";
    const entry =
      byCategory.get(id) ??
      { id, name: r.category_name ?? "Uncategorized", byMonth: zero(), total: 0 };
    entry.byMonth[r.month] += -amount;
    entry.total += -amount;
    byCategory.set(id, entry);
    spent[r.month] += -amount;
  }

  // Deducted from your paycheck before it reached the bank: earned, and invested.
  for (const p of payrollRows) {
    if (p.currency !== currency || !wanted.has(p.month)) continue;
    const amount = Number(p.total);
    payroll[p.month] += amount;
    income[p.month] += amount;
    invested[p.month] += amount;
  }

  for (const m of months) {
    spent[m] = round(spent[m]);
    income[m] = round(income[m]);
    payroll[m] = round(payroll[m]);
    invested[m] = round(invested[m]);
  }
  const categories = [...byCategory.values()]
    .map((c) => ({
      ...c,
      total: round(c.total),
      byMonth: Object.fromEntries(months.map((m) => [m, round(c.byMonth[m])])),
    }))
    .sort((a, b) => b.total - a.total);

  return { months, spent, income, payroll, invested, unreviewed, categories };
}

export const sum = (values: number[]) => round(values.reduce((a, b) => a + b, 0));

export type Change = {
  delta: number;
  /** Percent change; null when there is no previous amount to compare with. */
  pct: number | null;
};

export function change(current: number, previous: number): Change {
  return {
    delta: round(current - previous),
    pct: previous > 0 ? (current - previous) / previous : null,
  };
}

/** Share of income kept, or null when there was no income to compare against. */
export function savingsRate(income: number, spent: number): number | null {
  return income > 0 ? (income - spent) / income : null;
}

export type Slice = { id: string; label: string; value: number; color: string };

/**
 * Chart colors, in a fixed order. Validated for colorblind separation and
 * contrast; a 7th hue is never invented, so everything past the sixth is
 * folded into a gray "Other".
 */
export const SLOT_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];
export const OTHER_COLOR = "#a8a69f";
export const MAX_NAMED_SLICES = SLOT_COLORS.length;

/**
 * Category totals across several currencies' series, for deciding colors only.
 * (Ranking by a mixed sum is fine for that; amounts are never shown mixed.)
 */
export function mergeCategoryTotals(list: Series[]): { id: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const series of list) {
    for (const c of series.categories) totals.set(c.id, (totals.get(c.id) ?? 0) + c.total);
  }
  return [...totals.entries()].map(([id, total]) => ({ id, total }));
}

/**
 * Gives each of your biggest categories a color that stays with it, so
 * "Groceries is blue" holds on every month and page. Pass totals over a long
 * window (the year), not the single month being viewed.
 */
export function assignColors(categories: { id: string; total: number }[]) {
  const colors = new Map<string, string>();
  [...categories]
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total || a.id.localeCompare(b.id))
    .slice(0, MAX_NAMED_SLICES)
    .forEach((c, i) => colors.set(c.id, SLOT_COLORS[i]));
  return colors;
}

/**
 * Turns category amounts into chart slices: categories with an assigned color
 * keep it, everything else (and anything not positive) folds into "Other".
 */
export function toSlices(
  items: { id: string; name: string; value: number }[],
  colors: Map<string, string>,
): Slice[] {
  const named: Slice[] = [];
  const folded: { name: string; value: number }[] = [];

  for (const item of items) {
    if (item.value <= 0) continue;
    const color = colors.get(item.id);
    if (color) named.push({ id: item.id, label: item.name, value: item.value, color });
    else folded.push({ name: item.name, value: item.value });
  }

  named.sort((a, b) => b.value - a.value);
  if (folded.length > 0) {
    named.push({
      id: "other",
      // One folded category keeps its own name, so it can't be mistaken for the
      // real "Other" category; a group is called what it is.
      label: folded.length === 1 ? folded[0].name : `Everything else (${folded.length})`,
      value: round(folded.reduce((t, f) => t + f.value, 0)),
      color: OTHER_COLOR,
    });
  }
  return named;
}
