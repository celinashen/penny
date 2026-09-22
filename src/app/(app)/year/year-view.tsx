import Link from "next/link";
import { Card } from "@/components/card";
import { DonutChart, DonutLegend } from "@/components/charts/donut";
import { MonthlyBars } from "@/components/charts/monthly-bars";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SegmentedLinks } from "@/components/segmented-links";
import { Stat } from "@/components/stat";
import type { Currency } from "@/lib/accounts";
import { sum, toSlices, type Series } from "@/lib/spending";
import {
  formatMonthLabel,
  formatMoney,
  formatMoneyWhole,
} from "@/lib/transactions";
import type { CurrencyView } from "@/lib/view-params";
import { overviewHref } from "../overview-view";
import { YearTable } from "./year-table";

export type YearRange = "12m" | "ytd";

const CURRENCY_NAME: Record<Currency, string> = { USD: "US dollars", CAD: "Canadian dollars" };

export type YearSection = {
  currency: Currency;
  /** The months being shown (12 months, or January to now). */
  shown: Series;
};

export function yearHref(range: YearRange, mode: string) {
  const params = new URLSearchParams();
  if (range !== "12m") params.set("range", range);
  if (mode !== "both") params.set("cur", mode);
  const s = params.toString();
  return s ? `/year?${s}` : "/year";
}

export function YearView({
  range,
  view,
  months,
  hasData,
  sections,
  colors,
  allColors,
}: {
  range: YearRange;
  view: CurrencyView;
  months: string[];
  hasData: boolean;
  sections: YearSection[];
  /** The same category colors the Overview uses, so a category never changes color. */
  colors: Map<string, string>;
  /** A color for every category, including ones folded into "Everything else". */
  allColors: Map<string, string>;
}) {
  const first = months[0];
  const last = months[months.length - 1];
  const eyebrow =
    range === "ytd"
      ? `Year to date · ${last.slice(0, 4)}`
      : `Last 12 months · ${formatMonthLabel(first)} – ${formatMonthLabel(last)}`;

  return (
    <>
      <PageHeader eyebrow={eyebrow} title="Year" />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <SegmentedLinks<YearRange>
          label="Period"
          options={[
            { value: "12m", label: "Last 12 months" },
            { value: "ytd", label: "Year to date" },
          ]}
          current={range}
          hrefFor={(r) => yearHref(r, view.mode)}
        />
        {view.options.length > 0 && (
          <SegmentedLinks
            label="Currency"
            options={view.options}
            current={view.mode}
            hrefFor={(value) => yearHref(range, value)}
          />
        )}
      </div>

      {!hasData ? (
        <EmptyState
          title="No transactions in this period"
          description="Import a CSV or connect a bank, and your year will fill in here."
        >
          <Link
            href="/transactions/import"
            className="mt-4 rounded-full bg-foreground px-6 py-3 font-medium text-surface transition-opacity hover:opacity-85"
          >
            Import a CSV
          </Link>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-14">
          {sections.map((s) => (
            <YearSectionView
              key={s.currency}
              section={s}
              colors={colors}
              allColors={allColors}
              showHeading={sections.length > 1}
              mode={view.mode}
            />
          ))}
        </div>
      )}
    </>
  );
}

function YearSectionView({
  section,
  colors,
  allColors,
  showHeading,
  mode,
}: {
  section: YearSection;
  colors: Map<string, string>;
  allColors: Map<string, string>;
  showHeading: boolean;
  mode: string;
}) {
  const { currency, shown } = section;
  const { months } = shown;

  const spentByMonth = months.map((m) => shown.spent[m] ?? 0);
  const totalSpent = sum(spentByMonth);
  const totalIncome = sum(months.map((m) => shown.income[m] ?? 0));
  const net = Math.round((totalIncome - totalSpent) * 100) / 100;

  // Average over the months since your data begins, so a young history isn't diluted by empty months.
  const firstActive = months.findIndex((m) => (shown.spent[m] ?? 0) !== 0 || (shown.income[m] ?? 0) !== 0);
  const activeMonths = firstActive < 0 ? 0 : months.length - firstActive;
  const average = activeMonths > 0 ? totalSpent / activeMonths : 0;

  const peakIndex = spentByMonth.indexOf(Math.max(...spentByMonth));
  const peakMonth = months[peakIndex];

  const slices = toSlices(
    shown.categories.map((c) => ({ id: c.id, name: c.name, value: c.total })),
    colors,
    allColors,
  );

  return (
    <section aria-label={CURRENCY_NAME[currency]} className="flex flex-col gap-6">
      {showHeading && (
        <h2 className="flex items-baseline gap-3 text-2xl font-semibold tracking-[-0.03em]">
          {CURRENCY_NAME[currency]}
          <span className="font-mono text-xs font-normal uppercase tracking-wider text-muted">
            {currency}
          </span>
        </h2>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total spent" value={formatMoney(totalSpent, currency)}>
          <span className="text-sm text-muted">
            over {months.length} month{months.length === 1 ? "" : "s"}
          </span>
        </Stat>
        <Stat label="Monthly average" value={formatMoney(average, currency)}>
          <span className="text-sm text-muted">
            {activeMonths} month{activeMonths === 1 ? "" : "s"} with data
          </span>
        </Stat>
        <Stat
          label="Highest month"
          value={spentByMonth[peakIndex] > 0 ? formatMoney(spentByMonth[peakIndex], currency) : "—"}
        >
          <span className="text-sm text-muted">
            {spentByMonth[peakIndex] > 0 ? formatMonthLabel(peakMonth) : "No spending yet"}
          </span>
        </Stat>
        <Stat
          label="Net"
          value={formatMoney(net, currency, net !== 0)}
          tone={net < 0 ? "text-negative" : net > 0 ? "text-positive" : ""}
        >
          <span className="text-sm text-muted">
            {formatMoneyWhole(totalIncome, currency)} income
          </span>
        </Stat>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Spending by category" subtitle="Share of spending across this period.">
          {slices.length === 0 ? (
            <p className="text-muted">No spending in {currency} in this period.</p>
          ) : (
            <div className="flex flex-col items-center gap-6 @lg:flex-row">
              <DonutChart
                slices={slices}
                currency={currency}
                centerLabel="Spent"
                centerValue={formatMoneyWhole(totalSpent, currency)}
              />
              <DonutLegend slices={slices} currency={currency} />
            </div>
          )}
        </Card>

        <Card title="Spending by month" subtitle="Tap a bar to open that month.">
          <MonthlyBars
            months={months}
            values={spentByMonth}
            currency={currency}
            hrefFor={(m) => overviewHref(m, mode)}
            label={`Monthly spending in ${currency}`}
          />
        </Card>
      </div>

      <div>
        <h3 className="mb-1 text-xl font-semibold tracking-[-0.02em]">Every month, every category</h3>
        <p className="mb-4 text-sm text-muted">
          Darker cells are that category&rsquo;s bigger months. Tap an amount to see the
          transactions behind it. Scroll sideways for more months.
        </p>
        <YearTable
          currency={currency}
          series={shown}
          colors={allColors}
          txHref={(categoryId, month) =>
            `/transactions?category=${categoryId === "uncategorized" ? "none" : categoryId}&month=${month}`
          }
        />
      </div>
    </section>
  );
}
