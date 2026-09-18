import type { Currency } from "@/lib/accounts";
import type { Change } from "@/lib/spending";
import { formatMoneyWhole } from "@/lib/transactions";

/**
 * "▲ $212 (+8%) vs Aug". The arrow and words carry the direction so color is
 * never the only signal. For spending, going up is the bad direction.
 */
export function Delta({
  change,
  currency,
  versus,
  upIsGood = false,
}: {
  change: Change;
  currency: Currency;
  /** Name of the comparison period, e.g. "Aug". */
  versus: string;
  upIsGood?: boolean;
}) {
  if (change.delta === 0) {
    return <span className="text-sm text-muted">No change vs {versus}</span>;
  }

  const up = change.delta > 0;
  const good = up === upIsGood;
  const pct =
    change.pct === null ? "" : ` (${up ? "+" : "−"}${Math.round(Math.abs(change.pct) * 100)}%)`;

  return (
    <span className={`text-sm ${good ? "text-positive" : "text-negative"}`}>
      <span aria-hidden>{up ? "▲" : "▼"}</span>{" "}
      <span className="sr-only">{up ? "Up" : "Down"} </span>
      {formatMoneyWhole(Math.abs(change.delta), currency)}
      {pct} <span className="text-muted">vs {versus}</span>
    </span>
  );
}
