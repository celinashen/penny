import type { Currency } from "@/lib/accounts";
import type { Slice } from "@/lib/spending";
import { formatMoney } from "@/lib/transactions";

const R = 38;
const CIRCUMFERENCE = 2 * Math.PI * R;
// A 2px surface-colored gap between slices (the viewBox is 100 wide, ~176px).
const GAP = 1.2;

/**
 * Part-to-whole ring. Best read together with the legend beside it, which lists
 * the exact amount and share for every slice.
 */
export function DonutChart({
  slices,
  currency,
  centerLabel,
  centerValue,
}: {
  slices: Slice[];
  currency: Currency;
  centerLabel: string;
  centerValue: string;
}) {
  const total = slices.reduce((t, s) => t + s.value, 0);
  let offset = 0;

  return (
    <div className="relative mx-auto aspect-square w-44 shrink-0">
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label={`${centerLabel} ${centerValue}, split into ${slices.length} ${slices.length === 1 ? "category" : "categories"}`}
        className="h-full w-full -rotate-90"
      >
        {/* Empty track, so a month with no spending still shows a ring. */}
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-raised)" strokeWidth="13" />
        {total > 0 &&
          slices.map((s) => {
            const length = (s.value / total) * CIRCUMFERENCE;
            const visible = slices.length === 1 ? length : Math.max(0.5, length - GAP);
            const circle = (
              <circle
                key={s.id}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="13"
                strokeDasharray={`${visible} ${CIRCUMFERENCE - visible}`}
                strokeDashoffset={-offset}
                className="transition-opacity hover:opacity-80"
              >
                <title>{`${s.label}: ${formatMoney(s.value, currency)} (${percent(s.value / total)})`}</title>
              </circle>
            );
            offset += length;
            return circle;
          })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono text-[0.65rem] uppercase tracking-wider text-muted">{centerLabel}</span>
        <span className="text-xl font-semibold tracking-[-0.02em]">{centerValue}</span>
      </div>
    </div>
  );
}

export function percent(share: number) {
  if (share > 0 && share < 0.01) return "<1%";
  return `${Math.round(share * 100)}%`;
}

/** The legend doubles as the chart's table view: every value is listed here. */
export function DonutLegend({ slices, currency }: { slices: Slice[]; currency: Currency }) {
  const total = slices.reduce((t, s) => t + s.value, 0);
  if (slices.length === 0) return <p className="text-muted">No spending this period.</p>;

  return (
    <ul className="flex w-full min-w-0 flex-col gap-2.5 @lg:w-auto @lg:flex-1">
      {slices.map((s) => (
        <li key={s.id} className="flex items-center gap-3">
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ backgroundColor: s.color }}
          />
          <span className="min-w-0 flex-1 truncate">{s.label}</span>
          <span className="shrink-0 tabular-nums">{formatMoney(s.value, currency)}</span>
          <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted">
            {percent(s.value / total)}
          </span>
        </li>
      ))}
    </ul>
  );
}
