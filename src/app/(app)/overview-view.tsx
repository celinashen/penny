import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SegmentedLinks } from "@/components/segmented-links";
import type { Currency } from "@/lib/accounts";
import type { PaceResult, Today } from "@/lib/pace";
import type { Series } from "@/lib/spending";
import type { LargestRow, MerchantRow } from "@/lib/spending-data";
import {
  currentMonth,
  formatMonthLabel,
  shiftMonth,
  type CategoryKind,
} from "@/lib/transactions";
import type { CurrencyView } from "@/lib/view-params";
import { CurrencyOverview } from "./currency-overview";

const pill =
  "rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-raised";
const cta =
  "mt-4 rounded-full bg-foreground px-6 py-3 font-medium text-surface transition-opacity hover:opacity-85";

export type OverviewSection = {
  currency: Currency;
  /** The 12 months ending at the viewed month. */
  series: Series;
  pace: PaceResult;
  /** Running total per day so far, for a month still in progress. */
  cumulative: number[];
  merchants: MerchantRow[];
  largest: LargestRow[];
};

export type OverviewProps = {
  month: string; // YYYY-MM
  view: CurrencyView;
  hasAccounts: boolean;
  /** Any activity in the months shown. */
  hasData: boolean;
  /** Month of the newest transaction, to offer a way back to your data. */
  latestMonth?: string;
  sections: OverviewSection[];
  /** Set when the viewed month hasn't finished. */
  today: Today | null;
  /**
   * Category colors, ranked over the year and across every currency you use
   * (not just the ones on screen), so a category never changes color.
   */
  colors: Map<string, string>;
  /** Your categories, in your own order. */
  categories: { id: string; name: string; kind: CategoryKind }[];
};

/** Overview URL for a month and currency choice; defaults are left out. */
export function overviewHref(month: string, mode: string) {
  const params = new URLSearchParams();
  if (month !== currentMonth()) params.set("month", month);
  if (mode !== "both") params.set("cur", mode);
  const s = params.toString();
  return s ? `/?${s}` : "/";
}

export function OverviewView({
  month,
  view,
  hasAccounts,
  hasData,
  latestMonth,
  sections,
  today,
  colors,
  categories,
}: OverviewProps) {
  if (!hasAccounts) {
    return (
      <>
        <PageHeader eyebrow={formatMonthLabel(month)} title="Overview" />
        <EmptyState
          title="Nothing to show yet"
          description="Add an account, then connect your bank or import a CSV to see where your money goes."
        >
          <Link href="/accounts" className={cta}>
            Add an account
          </Link>
        </EmptyState>
      </>
    );
  }

  const expenseCategories = categories.filter((c) => c.kind === "expense");
  const investmentCategoryId = categories.find((c) => c.kind === "investment")?.id;
  const monthHref = (m: string) => overviewHref(m, view.mode);
  const txHref = (categoryId: string) =>
    `/transactions?category=${categoryId === "uncategorized" ? "none" : categoryId}&month=${month}`;

  return (
    <>
      <PageHeader eyebrow={formatMonthLabel(month)} title="Overview" />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={monthHref(shiftMonth(month, -1))} className={pill} aria-label="Previous month">
            &larr;
          </Link>
          <Link href={monthHref(currentMonth())} className={pill}>
            This month
          </Link>
          <Link href={monthHref(shiftMonth(month, 1))} className={pill} aria-label="Next month">
            &rarr;
          </Link>
        </div>

        {view.options.length > 0 && (
          <SegmentedLinks
            label="Currency"
            options={view.options}
            current={view.mode}
            hrefFor={(value) => overviewHref(month, value)}
          />
        )}
      </div>

      {!hasData ? (
        <EmptyState
          title="No transactions in the last 12 months"
          description={
            latestMonth
              ? `Your most recent activity is in ${formatMonthLabel(latestMonth)}.`
              : "Import a CSV or connect a bank to see your spending here."
          }
        >
          {latestMonth ? (
            <Link href={monthHref(latestMonth)} className={cta}>
              Go to {formatMonthLabel(latestMonth)}
            </Link>
          ) : (
            <Link href="/transactions/import" className={cta}>
              Import a CSV
            </Link>
          )}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-14">
          {sections.map((s) => (
            <CurrencyOverview
              key={s.currency}
              currency={s.currency}
              month={month}
              series={s.series}
              pace={s.pace}
              today={today}
              cumulative={s.cumulative}
              colors={colors}
              expenseCategories={expenseCategories}
              investmentCategoryId={investmentCategoryId}
              merchants={s.merchants}
              largest={s.largest}
              txHref={txHref}
              showHeading={sections.length > 1}
            />
          ))}
        </div>
      )}
    </>
  );
}
