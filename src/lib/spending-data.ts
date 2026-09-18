import type { SupabaseClient } from "@supabase/supabase-js";
import type { Currency } from "./accounts";
import type { AggRow, FlowRow } from "./spending";
import { monthRange } from "./transactions";

// Everything here asks the database for summaries (totals, a handful of top rows),
// never for individual transactions. What a page reads stays about the same size
// whether you have a thousand transactions or a million.
//
// All of it runs as the signed-in user, so row-level security limits it to their
// own data.

const PAGE = 1000;
const MAX_PAGES = 50;

/**
 * Monthly totals per currency and category for a run of months, read page by
 * page (the API returns at most 1000 rows at a time). `throughDay` adds how much
 * of each total fell on or before that day of the month, for projecting. Returns
 * null if a query fails.
 */
export async function fetchAggRows(
  supabase: SupabaseClient,
  months: string[],
  throughDay?: number,
): Promise<AggRow[] | null> {
  const range = monthRange(months[months.length - 1]);
  if (!range) return null;

  const rows: AggRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase
      .rpc("spending_by_month", {
        p_from: `${months[0]}-01`,
        p_to: range.to,
        p_day: throughDay ?? 31,
      })
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) return null;

    const batch = (data ?? []) as AggRow[];
    rows.push(
      ...batch.map((r) => ({
        ...r,
        total: Number(r.total),
        through_day: Number(r.through_day),
        txns: Number(r.txns),
      })),
    );
    if (batch.length < PAGE) break;
  }
  return rows;
}

/**
 * Deposits into your paycheck-funded investment accounts, per month and currency:
 * one small row per month. Returns null if the query fails.
 */
export async function fetchPayroll(
  supabase: SupabaseClient,
  months: string[],
): Promise<FlowRow[] | null> {
  const range = monthRange(months[months.length - 1]);
  if (!range) return null;
  const { data, error } = await supabase.rpc("payroll_contributions_by_month", {
    p_from: `${months[0]}-01`,
    p_to: range.to,
  });
  if (error) return null;
  return ((data ?? []) as FlowRow[]).map((r) => ({ ...r, total: Number(r.total) }));
}

export type DailyRow = { day: string; currency: Currency; total: number };

/** Spending per day for one month: at most 31 rows per currency. */
export async function fetchDaily(
  supabase: SupabaseClient,
  month: string,
): Promise<DailyRow[] | null> {
  const range = monthRange(month);
  if (!range) return null;
  const { data, error } = await supabase.rpc("spending_daily", {
    p_from: range.from,
    p_to: range.to,
  });
  if (error) return null;
  return ((data ?? []) as DailyRow[]).map((r) => ({ ...r, total: Number(r.total) }));
}

export type MerchantRow = { currency: Currency; name: string; total: number; txns: number };

/** The top few merchants by spending in a month, per currency. */
export async function fetchTopMerchants(
  supabase: SupabaseClient,
  month: string,
  limit = 5,
): Promise<MerchantRow[] | null> {
  const range = monthRange(month);
  if (!range) return null;
  const { data, error } = await supabase.rpc("top_merchants", {
    p_from: range.from,
    p_to: range.to,
    p_limit: limit,
  });
  if (error) return null;
  return ((data ?? []) as MerchantRow[]).map((r) => ({
    ...r,
    total: Number(r.total),
    txns: Number(r.txns),
  }));
}

export type LargestRow = { currency: Currency; posted_date: string; name: string; amount: number };

/** The biggest single purchases in a month, per currency. */
export async function fetchLargestPurchases(
  supabase: SupabaseClient,
  month: string,
  limit = 5,
): Promise<LargestRow[] | null> {
  const range = monthRange(month);
  if (!range) return null;
  const { data, error } = await supabase.rpc("largest_purchases", {
    p_from: range.from,
    p_to: range.to,
    p_limit: limit,
  });
  if (error) return null;
  return ((data ?? []) as LargestRow[]).map((r) => ({ ...r, amount: Number(r.amount) }));
}

/** Currencies you have accounts in, plus any that appear in the data. */
export async function fetchCurrencies(
  supabase: SupabaseClient,
  rows: AggRow[],
): Promise<Currency[]> {
  const { data } = await supabase.from("accounts").select("currency");
  const found = new Set<Currency>((data ?? []).map((a) => a.currency as Currency));
  for (const r of rows) found.add(r.currency);
  return [...found];
}
