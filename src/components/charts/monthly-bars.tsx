import Link from "next/link";
import type { Currency } from "@/lib/accounts";
import { formatMoney, formatMonthLabel } from "@/lib/transactions";
import { niceCeil } from "./nice";

const compact = (amount: number, currency: Currency) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);

const monthAbbrev = (m: string) =>
  new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1).toLocaleDateString("en-US", {
    month: "short",
  });

/**
 * One series, one color: the selected month is emphasized in the accent and the
 * rest sit in neutral gray. Each column is a link to that month, and carries a
 * tooltip on hover and keyboard focus.
 */
export function MonthlyBars({
  months,
  values,
  currency,
  selected,
  hrefFor,
  label,
}: {
  months: string[];
  values: number[];
  currency: Currency;
  /** Month to emphasize. Without one, every bar is accented and the peak is labeled. */
  selected?: string;
  hrefFor?: (month: string) => string;
  label: string;
}) {
  const max = niceCeil(Math.max(0, ...values));
  const peak = values.indexOf(Math.max(...values));
  const ticks = [max, max / 2, 0];

  return (
    // The plot is taller on wide screens, where the card sits beside a taller donut.
    <figure aria-label={label} className="[--plot:10rem] lg:[--plot:16rem]">
      <div className="flex gap-2">
        <div
          aria-hidden
          className="relative h-[var(--plot)] w-11 shrink-0 font-mono text-[0.65rem] leading-none text-muted"
        >
          {/* Each label sits on its gridline: the plot starts 1.5rem below the top. */}
          {ticks.map((t, i) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `calc(1.5rem + ${i / (ticks.length - 1)} * (100% - 1.5rem))` }}
            >
              {compact(t, currency)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-[var(--plot)] pt-6">
            {/* Hairline gridlines at each tick; the bottom one is the baseline. */}
            <div aria-hidden className="absolute inset-x-0 top-6 bottom-0 flex flex-col justify-between">
              {ticks.map((t, i) => (
                <div key={t} className={`h-px w-full ${i === ticks.length - 1 ? "bg-[#c3c2b7]" : "bg-line"}`} />
              ))}
            </div>

            <ol className="absolute inset-x-0 bottom-0 top-6 flex items-end gap-1">
              {months.map((m, i) => {
                const value = values[i] ?? 0;
                const height = value > 0 ? Math.max(2, (value / max) * 100) : 0;
                const active = selected ? m === selected : true;
                const showValue = selected ? m === selected : i === peak && value > 0;
                const edge = i < 2 ? "left-0" : i > months.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2";
                const text = `${formatMonthLabel(m)}: ${formatMoney(value, currency)}`;
                const column = (
                  <>
                    <div
                      aria-hidden
                      className={`w-full max-w-6 rounded-t-[4px] transition-colors ${
                        active ? "bg-accent" : "bg-[#cfcfc7] group-hover:bg-[#a9a99f]"
                      }`}
                      style={{ height: `${height}%` }}
                    />
                    {showValue && value > 0 && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium tabular-nums"
                        style={{ bottom: `calc(${height}% + 4px)` }}
                      >
                        {compact(value, currency)}
                      </span>
                    )}
                    <span
                      role="tooltip"
                      className={`pointer-events-none absolute bottom-full z-20 mb-2 hidden whitespace-nowrap rounded-lg border border-line bg-surface px-3 py-1.5 text-xs shadow-md group-hover:block group-focus-visible:block ${edge}`}
                    >
                      <span className="block font-semibold tabular-nums">{formatMoney(value, currency)}</span>
                      <span className="text-muted">{formatMonthLabel(m)}</span>
                    </span>
                  </>
                );
                const cls = "group relative flex h-full flex-1 items-end justify-center outline-offset-2";
                return (
                  <li key={m} className="flex h-full flex-1">
                    {hrefFor ? (
                      <Link href={hrefFor(m)} aria-label={text} className={cls}>
                        {column}
                      </Link>
                    ) : (
                      <div tabIndex={0} aria-label={text} className={cls}>
                        {column}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          <ol aria-hidden className="mt-2 flex gap-1 font-mono text-[0.65rem] text-muted">
            {months.map((m) => (
              <li key={m} className="flex-1 text-center">
                {monthAbbrev(m)}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </figure>
  );
}
