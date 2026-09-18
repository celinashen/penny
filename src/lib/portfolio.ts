import type { Currency } from "./accounts";
import { MAX_NAMED_SLICES, OTHER_COLOR, SLOT_COLORS, type Slice } from "./spending";

export type PortfolioAccount = {
  id: string;
  name: string;
  institution: string | null;
  subtype: string | null;
  currency: Currency;
  payroll_funded: boolean;
  /** Total value (securities plus cash) as last reported by the institution. */
  balance_current: number | null;
};

export type PortfolioHolding = {
  id: string;
  account_id: string;
  ticker: string | null;
  name: string | null;
  security_type: string | null;
  quantity: number;
  /** What was paid for the whole position, when the institution reports it. */
  cost_basis: number | null;
  price: number | null;
  market_value: number | null;
};

export type PortfolioTotals = {
  /** Everything in the account(s) today, cash included. */
  totalValue: number;
  /** Securities only. */
  holdingsValue: number;
  cash: number;
  /** What was paid for the holdings whose cost is known. */
  costBasis: number;
  /** Today's value of those same holdings. */
  valueWithBasis: number;
  gain: number;
  /** Gain as a share of cost; null when there's no cost to compare with. */
  gainPct: number | null;
  /** Holdings whose cost the institution didn't report, left out of gain/loss. */
  missingBasis: number;
};

const round = (n: number) => Math.round(n * 100) / 100;

/** A holding's value today. */
export function holdingValue(h: PortfolioHolding): number {
  if (h.market_value !== null) return h.market_value;
  if (h.price !== null) return h.price * h.quantity;
  return 0;
}

// Cash sitting in an account isn't a "position", so it has no cost basis to lack.
const isCash = (h: PortfolioHolding) => (h.security_type ?? "").toLowerCase() === "cash";

/**
 * Value and gain/loss for a set of accounts.
 *
 * Gain/loss covers only holdings with a known cost, so a position without one
 * can't make the total look better or worse than it is; those are counted in
 * `missingBasis` so the screen can say so.
 */
export function summarizePortfolio(
  accounts: PortfolioAccount[],
  holdings: PortfolioHolding[],
): PortfolioTotals {
  const ids = new Set(accounts.map((a) => a.id));
  const mine = holdings.filter((h) => ids.has(h.account_id));

  let totalValue = 0;
  let holdingsValue = 0;
  for (const a of accounts) {
    const value = mine.filter((h) => h.account_id === a.id).reduce((t, h) => t + holdingValue(h), 0);
    holdingsValue += value;
    // The institution's own total wins when it gave one; otherwise add up what we know.
    totalValue += a.balance_current ?? value;
  }

  let costBasis = 0;
  let valueWithBasis = 0;
  let missingBasis = 0;
  for (const h of mine) {
    if (isCash(h)) continue;
    if (h.cost_basis === null) {
      missingBasis++;
      continue;
    }
    costBasis += h.cost_basis;
    valueWithBasis += holdingValue(h);
  }

  const gain = round(valueWithBasis - costBasis);
  return {
    totalValue: round(totalValue),
    holdingsValue: round(holdingsValue),
    cash: round(Math.max(0, totalValue - holdingsValue)),
    costBasis: round(costBasis),
    valueWithBasis: round(valueWithBasis),
    gain,
    gainPct: costBasis > 0 ? gain / costBasis : null,
    missingBasis,
  };
}

/** A holding's own gain or loss, or null when its cost is unknown. */
export function holdingGain(h: PortfolioHolding): { gain: number; pct: number | null } | null {
  if (h.cost_basis === null || isCash(h)) return null;
  const gain = round(holdingValue(h) - h.cost_basis);
  return { gain, pct: h.cost_basis > 0 ? gain / h.cost_basis : null };
}

// Asset types in a fixed order, so a type keeps its color everywhere.
const TYPE_LABELS: [match: string, label: string][] = [
  ["equity", "Stocks"],
  ["etf", "ETFs"],
  ["mutual fund", "Mutual funds"],
  ["fixed income", "Bonds"],
  ["cash", "Cash"],
];

function typeLabel(securityType: string | null): string {
  const t = (securityType ?? "").toLowerCase();
  return TYPE_LABELS.find(([match]) => t === match)?.[1] ?? "Other";
}

/**
 * How the portfolio splits by kind of asset. Cash held in the account outside of
 * a cash holding is added to Cash. Types keep a fixed color; anything past the
 * palette folds into a gray "Other".
 */
export function allocation(
  accounts: PortfolioAccount[],
  holdings: PortfolioHolding[],
): Slice[] {
  const ids = new Set(accounts.map((a) => a.id));
  const byLabel = new Map<string, number>();
  for (const h of holdings) {
    if (!ids.has(h.account_id)) continue;
    const label = typeLabel(h.security_type);
    byLabel.set(label, (byLabel.get(label) ?? 0) + holdingValue(h));
  }
  const totals = summarizePortfolio(accounts, holdings);
  // Uninvested cash the institution reports beyond the cash holdings we have.
  const cashHoldings = byLabel.get("Cash") ?? 0;
  const spareCash = Math.max(0, totals.totalValue - totals.holdingsValue);
  if (spareCash > 0) byLabel.set("Cash", cashHoldings + spareCash);

  const order = [...TYPE_LABELS.map(([, label]) => label), "Other"];
  const slices: Slice[] = [];
  order.forEach((label, i) => {
    const value = byLabel.get(label) ?? 0;
    if (value <= 0) return;
    slices.push({
      id: label,
      label,
      value: round(value),
      color: label === "Other" || i >= MAX_NAMED_SLICES ? OTHER_COLOR : SLOT_COLORS[i],
    });
  });
  return slices.sort((a, b) => b.value - a.value);
}
