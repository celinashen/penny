import type { Currency } from "@/lib/accounts";
import { holdingGain, holdingValue, type PortfolioHolding } from "@/lib/portfolio";
import { formatMoney } from "@/lib/transactions";

const DASH = <span className="text-muted/60">&mdash;</span>;

const quantity = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(n);

const TYPE_NAMES: Record<string, string> = {
  equity: "Stock",
  etf: "ETF",
  "mutual fund": "Mutual fund",
  "fixed income": "Bond",
  cash: "Cash",
  derivative: "Option",
  cryptocurrency: "Crypto",
};

/** Every position, biggest first, with what it's worth and how it's done. */
export function HoldingsTable({
  holdings,
  accountNames,
  currency,
}: {
  holdings: PortfolioHolding[];
  /** Account id -> name; the column shows only when there's more than one account. */
  accountNames: Map<string, string>;
  currency: Currency;
}) {
  const sorted = [...holdings].sort((a, b) => holdingValue(b) - holdingValue(a));
  const showAccount = accountNames.size > 1;
  const th = "px-2 pb-2 text-right font-normal";
  const td = "whitespace-nowrap px-2 py-2.5 text-right tabular-nums";

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="font-mono text-xs uppercase tracking-wider text-muted">
          <tr className="border-b border-line">
            <th className="px-1 pb-2 font-normal">Holding</th>
            {showAccount && <th className="px-2 pb-2 font-normal">Account</th>}
            <th className={th}>Shares</th>
            <th className={th}>Price</th>
            <th className={th}>Value</th>
            <th className={th}>Cost</th>
            <th className={`${th} pr-1`}>Gain / loss</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sorted.map((h) => {
            const g = holdingGain(h);
            return (
              <tr key={h.id}>
                <td className="px-1 py-2.5">
                  <span className="block font-medium">{h.ticker ?? h.name ?? "Unnamed"}</span>
                  <span className="block max-w-[16rem] truncate text-xs text-muted">
                    {[h.ticker ? h.name : null, TYPE_NAMES[(h.security_type ?? "").toLowerCase()]]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </td>
                {showAccount && (
                  <td className="px-2 py-2.5 text-muted">
                    <span className="block max-w-[10rem] truncate">{accountNames.get(h.account_id)}</span>
                  </td>
                )}
                <td className={td}>{quantity(h.quantity)}</td>
                <td className={`${td} text-muted`}>{h.price === null ? DASH : formatMoney(h.price, currency)}</td>
                <td className={`${td} font-medium`}>{formatMoney(holdingValue(h), currency)}</td>
                <td className={`${td} text-muted`}>
                  {h.cost_basis === null ? DASH : formatMoney(h.cost_basis, currency)}
                </td>
                <td className={`${td} pr-1`}>
                  {g === null ? (
                    DASH
                  ) : (
                    <span className="inline-flex flex-col items-end">
                      <span className={`whitespace-nowrap ${g.gain < 0 ? "text-negative" : "text-positive"}`}>
                        <span aria-hidden>{g.gain === 0 ? "" : g.gain > 0 ? "▲ " : "▼ "}</span>
                        <span className="sr-only">{g.gain > 0 ? "Up " : g.gain < 0 ? "Down " : ""}</span>
                        {formatMoney(Math.abs(g.gain), currency)}
                      </span>
                      {g.pct !== null && (
                        <span className="text-xs text-muted">
                          {g.gain < 0 ? "−" : "+"}
                          {Math.abs(Math.round(g.pct * 1000) / 10)}%
                        </span>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
