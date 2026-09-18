import Link from "next/link";
import { Card } from "@/components/card";
import { DonutChart, DonutLegend } from "@/components/charts/donut";
import { Delta } from "@/components/delta";
import { Stat } from "@/components/stat";
import type { Currency } from "@/lib/accounts";
import type { PaceResult, Today } from "@/lib/pace";
import { change, savingsRate, toSlices, type Series } from "@/lib/spending";
import type { LargestRow, MerchantRow } from "@/lib/spending-data";
import {
  formatDay,
  formatMoney,
  formatMoneyWhole,
  formatMonthLabel,
  monthShort,
  shiftMonth,
} from "@/lib/transactions";
import { CompareTable } from "./compare-table";
import { OnTrack } from "./on-track";
import { YearTable } from "./year/year-table";

const CURRENCY_NAME: Record<Currency, string> = {
  USD: "US dollars",
  CAD: "Canadian dollars",
};

/** Everything for one currency, for the selected month. */
export function CurrencyOverview({
  currency,
  month,
  series,
  pace,
  today,
  cumulative,
  colors,
  merchants,
  largest,
  txHref,
  showHeading,
  expenseCategories,
  investmentCategoryId,
}: {
  currency: Currency;
  month: string;
  /** The 12 months ending at `month`, for the totals and the rolling matrix. */
  series: Series;
  /** This month against your history, with the month-end projection. */
  pace: PaceResult;
  /** Set when `month` is still in progress. */
  today: Today | null;
  /** Running total per day so far (only for a month in progress). */
  cumulative: number[];
  /** Category colors, shared across every section so a category never changes color. */
  colors: Map<string, string>;
  merchants: MerchantRow[];
  largest: LargestRow[];
  txHref: (categoryId: string) => string;
  showHeading: boolean;
  /** Every spending category you have, so the matrix lists them all. */
  expenseCategories: { id: string; name: string }[];
  /** Where contributions are filed, to link to them. */
  investmentCategoryId?: string;
}) {
  const prev = shiftMonth(month, -1);
  const inProgress = today !== null;
  const income = series.income[month] ?? 0;
  const spent = pace.totals.spent;
  const net = Math.round((income - spent) * 100) / 100;
  const rate = savingsRate(income, spent);
  const unreviewed = series.unreviewed[month] ?? 0;

  const invested = series.invested[month] ?? 0;
  const investedBefore = series.invested[prev] ?? 0;
  const investedYear = series.months.reduce((t, m) => t + (series.invested[m] ?? 0), 0);
  const investedShare = income > 0 ? invested / income : null;
  const spentYear = series.months.reduce((t, m) => t + (series.spent[m] ?? 0), 0);
  const incomeYear = series.months.reduce((t, m) => t + (series.income[m] ?? 0), 0);
  const first = series.months[0];

  const slices = toSlices(
    pace.categories.map((c) => ({ id: c.id, name: c.name, value: c.spent })),
    colors,
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
        <Stat label={inProgress ? "Spent so far" : "Spent"} value={formatMoney(spent, currency)}>
          {pace.totals.previous > 0 || spent > 0 ? (
            <Delta
              change={change(spent, pace.totals.previous)}
              currency={currency}
              versus={inProgress ? `${monthShort(prev)}, same days` : monthShort(prev)}
            />
          ) : null}
        </Stat>
        <Stat label="Income" value={formatMoney(income, currency)}>
          <span className="text-sm text-muted">
            {series.income[prev] ? `${formatMoneyWhole(series.income[prev], currency)} in ${monthShort(prev)}` : " "}
          </span>
        </Stat>
        <Stat
          label="Net"
          value={formatMoney(net, currency, net !== 0)}
          tone={net < 0 ? "text-negative" : net > 0 ? "text-positive" : ""}
        >
          <span className="text-sm text-muted">Income minus spending</span>
        </Stat>
        <Stat label="Savings rate" value={rate === null ? "—" : `${Math.round(rate * 100)}%`}>
          <span className="text-sm text-muted">
            {rate === null ? "No income this month" : "Share of income kept"}
          </span>
        </Stat>
      </div>

      <section
        aria-label="Investment contributions"
        className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-2xl border border-line bg-surface p-5 sm:p-6"
      >
        <div className="min-w-0">
          <p className="text-sm text-muted">Contributed to investments in {formatMonthLabel(month)}</p>
          <p className="mt-1.5 text-3xl font-semibold tracking-[-0.03em]">
            {formatMoney(invested, currency)}
          </p>
          <div className="mt-1.5 min-h-5">
            {invested === 0 && investedBefore === 0 ? (
              <span className="text-sm text-muted">
                Transfers to Robinhood, Fidelity and similar are filed under Investments.
              </span>
            ) : inProgress ? (
              // A part-month total against a whole month isn't a fair comparison.
              <span className="text-sm text-muted">
                {formatMoneyWhole(investedBefore, currency)} in {monthShort(prev)}
              </span>
            ) : (
              <Delta
                change={change(invested, investedBefore)}
                currency={currency}
                versus={monthShort(prev)}
                upIsGood
              />
            )}
          </div>
        </div>

        <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-muted">Share of income</dt>
            <dd className="mt-0.5 text-base font-medium">
              {investedShare === null ? "—" : `${Math.round(investedShare * 100)}%`}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Past 12 months</dt>
            <dd className="mt-0.5 text-base font-medium">{formatMoneyWhole(investedYear, currency)}</dd>
          </div>
          {investmentCategoryId && (
            <div className="self-end">
              <Link
                href={`/transactions?category=${investmentCategoryId}&month=${month}`}
                className="font-medium underline underline-offset-4 hover:text-accent"
              >
                View contributions &rarr;
              </Link>
            </div>
          )}
        </dl>
      </section>

      {unreviewed > 0 && (
        <Link
          href={`/transactions?category=none&month=${month}`}
          className="rounded-2xl border border-line bg-surface px-5 py-3.5 text-sm transition-colors hover:bg-raised"
        >
          <span className="font-medium text-warn">
            {unreviewed} money-in transaction{unreviewed === 1 ? "" : "s"}
          </span>{" "}
          couldn&rsquo;t be categorized, so {unreviewed === 1 ? "it isn’t" : "they aren’t"} counted as
          income yet. Review {unreviewed === 1 ? "it" : "them"} &rarr;
        </Link>
      )}

      <OnTrack currency={currency} month={month} pace={pace} today={today} cumulative={cumulative} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Spending by category"
          subtitle={`Share of ${inProgress ? "spending so far this month" : "this month’s spending"}.`}
        >
          {slices.length === 0 ? (
            <p className="text-muted">No spending in {currency} this month.</p>
          ) : (
            <div className="flex flex-col items-center gap-6 @lg:flex-row">
              <DonutChart
                slices={slices}
                currency={currency}
                centerLabel="Spent"
                centerValue={formatMoneyWhole(spent, currency)}
              />
              <DonutLegend slices={slices} currency={currency} />
            </div>
          )}
        </Card>

        <Card title="Where it went" subtitle="The most money, and the biggest single charges.">
          {merchants.length === 0 && largest.length === 0 ? (
            <p className="text-muted">No purchases yet.</p>
          ) : (
            <div className="flex flex-col gap-6">
              <div>
                <h3 className="mb-1 font-mono text-xs uppercase tracking-wider text-muted">Top merchants</h3>
                <ul className="divide-y divide-line">
                  {merchants.map((m) => (
                    <li key={m.name} className="flex items-center justify-between gap-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate">{m.name}</p>
                        <p className="text-sm text-muted">
                          {m.txns} purchase{m.txns === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className="shrink-0 tabular-nums">{formatMoney(m.total, currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-1 font-mono text-xs uppercase tracking-wider text-muted">Biggest purchases</h3>
                <ul className="divide-y divide-line">
                  {largest.map((t, i) => (
                    <li key={i} className="flex items-center justify-between gap-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate">{t.name}</p>
                        <p className="text-sm text-muted">{formatDay(t.posted_date)}</p>
                      </div>
                      <span className="shrink-0 tabular-nums">{formatMoney(-t.amount, currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Card>
      </div>

      <CompareTable currency={currency} month={month} pace={pace} colors={colors} txHref={txHref} />

      <div>
        <h3 className="mb-1 text-xl font-semibold tracking-[-0.02em]">Rolling 12 months</h3>
        <p className="mb-3 text-sm text-muted">
          Every category for each of the past 12 months, {formatMonthLabel(first)} to{" "}
          {formatMonthLabel(month)}. The Total column and the bottom rows add up the whole year.
        </p>
        <dl className="mb-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <dt className="text-muted">Spent</dt>
            <dd className="text-base font-medium">{formatMoneyWhole(spentYear, currency)}</dd>
          </div>
          <div>
            <dt className="text-muted">Invested</dt>
            <dd className="text-base font-medium">{formatMoneyWhole(investedYear, currency)}</dd>
          </div>
          <div>
            <dt className="text-muted">Income</dt>
            <dd className="text-base font-medium">{formatMoneyWhole(incomeYear, currency)}</dd>
          </div>
        </dl>
        <YearTable
          currency={currency}
          series={series}
          colors={colors}
          allCategories={expenseCategories}
          txHref={(categoryId, m) =>
            `/transactions?category=${categoryId === "uncategorized" ? "none" : categoryId}&month=${m}`
          }
        />
      </div>
    </section>
  );
}
