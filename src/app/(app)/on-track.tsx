import { Card } from "@/components/card";
import { PaceChart } from "@/components/charts/pace-chart";
import type { Currency } from "@/lib/accounts";
import {
  MIN_HISTORY_MONTHS,
  OVER_MIN_AMOUNT,
  overspending,
  type CategoryPace,
  type PaceResult,
  type Today,
} from "@/lib/pace";
import { formatMoney, formatMoneyWhole, formatMonthLabel } from "@/lib/transactions";

/**
 * Are you running over your usual spending? Compares this month with your own
 * 12-month average, projects where the month will finish, and lists the
 * categories that are over.
 */
export function OnTrack({
  currency,
  month,
  pace,
  today,
  cumulative,
}: {
  currency: Currency;
  month: string;
  pace: PaceResult;
  today: Today | null;
  /** Running total per day so far this month (only for a month in progress). */
  cumulative: number[];
}) {
  const over = overspending(pace);
  const { totals } = pace;
  const label = formatMonthLabel(month);
  const finalAmount = pace.inProgress ? totals.projected : totals.spent;
  const difference = Math.round((finalAmount - totals.average) * 100) / 100;
  // A couple of dollars either way is noise, not "over" or "under".
  const notable = Math.abs(difference) >= Math.max(OVER_MIN_AMOUNT, totals.average * 0.05);

  return (
    <Card
      title={pace.inProgress ? "Are you on track?" : "Compared with your typical month"}
      subtitle={
        pace.hasHistory
          ? `Your typical month is the average of your last ${pace.historyMonths} months. ${
              pace.inProgress ? "The projection uses how much you usually have spent by this day." : ""
            }`
          : undefined
      }
    >
      {!pace.hasHistory ? (
        <p className="text-muted">
          Once you have {MIN_HISTORY_MONTHS} months of transactions, this will show where you&rsquo;re
          overspending and where the month is headed. You have {pace.historyMonths} so far.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          <div>
            <p className="text-xl font-semibold tracking-[-0.02em]">
              {pace.inProgress ? "On pace to spend " : "You spent "}
              {formatMoney(finalAmount, currency)}
              {" — "}
              {notable ? (
                <>
                  <span className={difference > 0 ? "text-negative" : "text-positive"}>
                    {formatMoneyWhole(Math.abs(difference), currency)} {difference > 0 ? "over" : "under"}
                  </span>{" "}
                  your typical {formatMoneyWhole(totals.average, currency)}
                </>
              ) : (
                <>in line with your typical {formatMoneyWhole(totals.average, currency)}</>
              )}
            </p>
            <p className="mt-1.5 text-sm text-muted">
              {over.length === 0
                ? "No category is running noticeably over its average."
                : over.length === 1
                  ? `1 category ${pace.inProgress ? "is running" : "went"} over its average.`
                  : `${over.length} categories ${pace.inProgress ? "are running" : "went"} over their averages.`}
            </p>
          </div>

          {pace.inProgress && today && cumulative.length > 0 && (
            <PaceChart
              daysInMonth={today.daysInMonth}
              cumulative={cumulative}
              projected={totals.projected}
              average={totals.average}
              currency={currency}
              monthLabel={label}
            />
          )}

          {over.length > 0 && (
            <div>
              <h3 className="mb-4 text-lg font-semibold tracking-[-0.02em]">Where you&rsquo;re overspending</h3>
              <ul className="flex flex-col gap-5">
                {(() => {
                  // One scale for every bar, so their lengths can be compared.
                  const scale = Math.max(...over.map((c) => Math.max(c.projected, c.average, c.spent)));
                  return over.map((c) => (
                    <OverspendRow key={c.id} c={c} currency={currency} scale={scale} inProgress={pace.inProgress} />
                  ));
                })()}
              </ul>
              <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted">
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden className="inline-block h-2.5 w-5 rounded-sm bg-accent" />
                  {pace.inProgress ? "Spent so far" : "Spent"}
                </span>
                {pace.inProgress && (
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden className="inline-block h-2.5 w-5 rounded-sm bg-accent/30" />
                    Still expected
                  </span>
                )}
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden className="inline-block h-4 w-0.5 bg-foreground" />
                  Your average
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/** One over-budget category: a bar of what's spent and expected, with a tick at your average. */
function OverspendRow({
  c,
  currency,
  scale,
  inProgress,
}: {
  c: CategoryPace;
  currency: Currency;
  scale: number;
  inProgress: boolean;
}) {
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / scale) * 100))}%`;
  const spent = Math.max(0, c.spent);
  const end = Math.max(spent, c.projected);

  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-medium">{c.name}</span>
        <span className="shrink-0 text-sm font-medium text-negative">
          <span aria-hidden>{"▲"}</span>
          <span className="sr-only">Over by </span> {formatMoneyWhole(c.overBy, currency)} over average
        </span>
      </div>

      <div
        className="relative mt-2 h-2.5 rounded-full bg-raised"
        role="img"
        aria-label={`${c.name}: ${formatMoneyWhole(spent, currency)} spent, ${formatMoneyWhole(end, currency)} expected, average ${formatMoneyWhole(c.average, currency)}`}
      >
        {inProgress && (
          <div className="absolute inset-y-0 left-0 rounded-full bg-accent/30" style={{ width: pct(end) }} />
        )}
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: pct(spent) }} />
        <div
          aria-hidden
          className="absolute -inset-y-1 w-0.5 rounded bg-foreground"
          style={{ left: pct(c.average) }}
        />
      </div>

      <p className="mt-1.5 text-sm text-muted">
        {formatMoneyWhole(spent, currency)} {inProgress ? "so far" : "spent"}
        {inProgress ? ` · on pace for ${formatMoneyWhole(c.projected, currency)}` : ""}
        {" · "}average {formatMoneyWhole(c.average, currency)}
      </p>
    </li>
  );
}
