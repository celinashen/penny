import { PageHeader } from "@/components/page-header";
import {
  assignAllColors,
  assignColors,
  buildSeries,
  mergeCategoryTotals,
  monthsEndingAt,
  monthsYearToDate,
} from "@/lib/spending";
import { fetchAggRows, fetchCurrencies, fetchPayroll } from "@/lib/spending-data";
import { createClient } from "@/lib/supabase/server";
import { currentMonth } from "@/lib/transactions";
import { resolveCurrencyView } from "@/lib/view-params";
import { YearView, type YearRange } from "./year-view";

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Year({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const range: YearRange = first(sp.range) === "ytd" ? "ytd" : "12m";

  const end = currentMonth();
  // Always load 12 months: category colors are ranked over that window so they
  // match the Overview, even when only the year to date is displayed.
  const last12 = monthsEndingAt(end, 12);
  const shownMonths = range === "ytd" ? monthsYearToDate(end) : last12;

  const supabase = await createClient();
  const [rows, payroll] = await Promise.all([
    fetchAggRows(supabase, last12),
    fetchPayroll(supabase, last12),
  ]);
  if (!rows || !payroll) {
    return (
      <>
        <PageHeader title="Year" />
        <p role="alert" className="text-negative">
          Couldn&rsquo;t load your spending. Refresh to try again.
        </p>
      </>
    );
  }

  const currencies = await fetchCurrencies(supabase, rows);
  const view = resolveCurrencyView(first(sp.cur), currencies);
  const shownSet = new Set(shownMonths);
  // Same colors as the Overview: ranked over the last 12 months and every currency.
  const merged = mergeCategoryTotals(currencies.map((c) => buildSeries(rows, c, last12, payroll)));
  const colors = assignColors(merged);
  const allColors = assignAllColors(merged);

  return (
    <YearView
      range={range}
      view={view}
      months={shownMonths}
      hasData={rows.some((r) => shownSet.has(r.month))}
      colors={colors}
      allColors={allColors}
      sections={view.shown.map((currency) => ({
        currency,
        shown: buildSeries(rows, currency, shownMonths, payroll),
      }))}
    />
  );
}
