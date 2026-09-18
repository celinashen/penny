import type { Currency } from "@/lib/accounts";
import { change } from "@/lib/spending";
import { formatMoneyWhole } from "@/lib/transactions";

/**
 * A change in spending: arrow, amount and percent, never color alone. For
 * spending, going up is the bad direction.
 */
export function ChangeCell({
  now,
  before,
  currency,
}: {
  now: number;
  before: number;
  currency: Currency;
}) {
  const c = change(now, before);
  // A change under fifty cents shows as $0, so don't draw an arrow for it.
  if (Math.abs(c.delta) < 0.5) return <span className="text-muted">&mdash;</span>;

  const up = c.delta > 0;
  const tone = up ? "text-negative" : "text-positive";
  return (
    <span className="inline-flex flex-col items-end">
      <span className={`whitespace-nowrap ${tone}`}>
        <span aria-hidden>{up ? "▲" : "▼"}</span>
        <span className="sr-only">{up ? "Up " : "Down "}</span> {formatMoneyWhole(Math.abs(c.delta), currency)}
      </span>
      <span className="text-xs text-muted">
        {c.pct === null ? "new" : `${up ? "+" : "−"}${Math.round(Math.abs(c.pct) * 100)}%`}
      </span>
    </span>
  );
}
