import { PageHeader } from "@/components/page-header";
import { countryName } from "@/lib/categorize/foreign";
import { buildPace, cumulativeByDay, type Today } from "@/lib/pace";
import { assignAllColors, assignColors, buildSeries, mergeCategoryTotals, monthsEndingAt } from "@/lib/spending";
import {
  fetchAggRows,
  fetchCurrencies,
  fetchDaily,
  fetchLargestPurchases,
  fetchPayroll,
  fetchTopMerchants,
} from "@/lib/spending-data";
import { createClient } from "@/lib/supabase/server";
import { currentMonth, monthRange, type CategoryKind } from "@/lib/transactions";
import { resolveCurrencyView } from "@/lib/view-params";
import { OverviewView } from "./overview-view";

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Overview({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const requested = first(sp.month);
  const month = monthRange(requested) ? requested : currentMonth(now);

  // Only the current month is still in progress; its projection needs today's date.
  const today: Today | null =
    month === currentMonth(now)
      ? { day: now.getDate(), daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() }
      : null;

  // The viewed month plus the twelve before it: the twelve before are your average.
  const months13 = monthsEndingAt(month, 13);
  const months12 = months13.slice(1);

  // Everything below is a summary read: totals and a handful of top rows. The page
  // never loads individual transactions, so it stays fast however many you have.
  const supabase = await createClient();
  const [rows, daily, merchants, largest, payroll] = await Promise.all([
    fetchAggRows(supabase, months13, today?.day),
    today ? fetchDaily(supabase, month) : Promise.resolve([]),
    fetchTopMerchants(supabase, month),
    fetchLargestPurchases(supabase, month),
    fetchPayroll(supabase, months12),
  ]);

  if (!rows || !daily || !merchants || !largest || !payroll) {
    return (
      <>
        <PageHeader title="Overview" />
        <p role="alert" className="text-negative">
          Couldn&rsquo;t load your spending. Refresh to try again.
        </p>
      </>
    );
  }

  // Purchases made abroad that aren't already accounted for by a trip, recent
  // enough to still be worth a nudge -- "flag at the top of Overview" that a
  // trip might be worth creating for them.
  const recentCutoff = new Date(now);
  recentCutoff.setDate(recentCutoff.getDate() - 60);

  const [currencies, accounts, latest, categoriesRes, foreignRes] = await Promise.all([
    fetchCurrencies(supabase, rows),
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("closed", false),
    supabase
      .from("transactions")
      .select("posted_date")
      .order("posted_date", { ascending: false })
      .limit(1),
    supabase.from("categories").select("id, name, kind").order("sort_order"),
    supabase
      .from("transactions")
      .select("country, posted_date")
      .not("country", "is", null)
      .is("trip_id", null)
      .gte("posted_date", recentCutoff.toISOString().slice(0, 10)),
  ]);

  const foreignRows = (foreignRes.data ?? []) as { country: string; posted_date: string }[];
  const tripSuggestion =
    foreignRows.length > 0
      ? {
          countries: [...new Set(foreignRows.map((r) => countryName(r.country)))],
          count: foreignRows.length,
          from: foreignRows.reduce((min, r) => (r.posted_date < min ? r.posted_date : min), foreignRows[0].posted_date),
          to: foreignRows.reduce((max, r) => (r.posted_date > max ? r.posted_date : max), foreignRows[0].posted_date),
        }
      : null;

  const view = resolveCurrencyView(first(sp.cur), currencies);
  // Income here includes contributions deducted from your paycheck into investments.
  const seriesByCurrency = new Map(currencies.map((c) => [c, buildSeries(rows, c, months12, payroll)]));
  // Colors are decided from every currency, not just the ones shown.
  const merged = mergeCategoryTotals([...seriesByCurrency.values()]);
  const colors = assignColors(merged);
  const allColors = assignAllColors(merged);
  const inWindow = new Set(months12);

  return (
    <OverviewView
      month={month}
      view={view}
      today={today}
      hasAccounts={Boolean(accounts.count)}
      hasData={rows.some((r) => inWindow.has(r.month))}
      latestMonth={latest.data?.[0]?.posted_date?.slice(0, 7)}
      colors={colors}
      allColors={allColors}
      tripSuggestion={tripSuggestion}
      categories={(categoriesRes.data ?? []) as { id: string; name: string; kind: CategoryKind }[]}
      sections={view.shown.map((currency) => ({
        currency,
        series: seriesByCurrency.get(currency) ?? buildSeries(rows, currency, months12, payroll),
        pace: buildPace({ rows, currency, month, today }),
        cumulative: today
          ? cumulativeByDay(daily.filter((d) => d.currency === currency), today.day)
          : [],
        merchants: merchants.filter((m) => m.currency === currency),
        largest: largest.filter((l) => l.currency === currency),
      }))}
    />
  );
}
