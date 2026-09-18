import { Card } from "@/components/card";
import { DonutChart, DonutLegend } from "@/components/charts/donut";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SegmentedLinks } from "@/components/segmented-links";
import { Stat } from "@/components/stat";
import type { Currency } from "@/lib/accounts";
import {
  allocation,
  summarizePortfolio,
  type PortfolioAccount,
  type PortfolioHolding,
} from "@/lib/portfolio";
import { timeAgo } from "@/lib/time";
import { formatDay, formatMoney, formatMoneyWhole } from "@/lib/transactions";
import type { CurrencyView } from "@/lib/view-params";
import { ConnectBankButton } from "../accounts/connect-bank-button";
import { HoldingsTable } from "./holdings-table";
import { PayrollToggle } from "./payroll-toggle";

export type InvestmentAccount = PortfolioAccount & { balance_as_of: string | null };

export type FlowItem = {
  id: string;
  posted_date: string;
  amount: number;
  description: string | null;
  accountName: string;
  payrollFunded: boolean;
  currency: Currency;
};

/** Money put into investments, for one currency. */
export type ContributionStats = {
  thisMonth: number;
  /** Of `thisMonth`, what was taken from your paycheck. */
  payrollThisMonth: number;
  last12: number;
  payroll12: number;
};

const CURRENCY_NAME: Record<Currency, string> = { USD: "US dollars", CAD: "Canadian dollars" };

const SUBTYPES: Record<string, string> = {
  "401k": "401(k)",
  "401a": "401(a)",
  "403b": "403(b)",
  ira: "IRA",
  roth: "Roth IRA",
  "roth 401k": "Roth 401(k)",
  brokerage: "Brokerage",
  hsa: "HSA",
  "stock plan": "Stock plan",
  pension: "Pension",
};
const subtypeLabel = (s: string | null) =>
  s ? (SUBTYPES[s.toLowerCase()] ?? s.charAt(0).toUpperCase() + s.slice(1)) : "Investment";

export function investmentsHref(mode: string) {
  return mode === "both" ? "/investments" : `/investments?cur=${mode}`;
}

const signed = (n: number, currency: Currency) =>
  `${n < 0 ? "−" : "+"}${formatMoney(Math.abs(n), currency)}`;
const pct = (share: number) => `${share < 0 ? "−" : "+"}${Math.abs(Math.round(share * 1000) / 10)}%`;

export function PortfolioView({
  view,
  accounts,
  holdings,
  flows,
  contributions,
  confirmNew,
}: {
  view: CurrencyView;
  accounts: InvestmentAccount[];
  holdings: PortfolioHolding[];
  flows: FlowItem[];
  contributions: Partial<Record<Currency, ContributionStats>>;
  confirmNew: boolean;
}) {
  return (
    <>
      <PageHeader
        title="Investments"
        description="What you own, what it&rsquo;s worth today, and how much you&rsquo;ve put in."
      />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <ConnectBankButton
          kind="investment"
          label="+ Connect an investment account"
          confirmNew={confirmNew}
        />
        {view.options.length > 0 && (
          <SegmentedLinks
            label="Currency"
            options={view.options}
            current={view.mode}
            hrefFor={investmentsHref}
          />
        )}
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          title="No investment accounts yet"
          description="Connect Fidelity, Robinhood or another brokerage to see your holdings, their value, and your gain or loss. Deposits into a Fidelity account count as money from your paycheck, and are added to your income."
        />
      ) : (
        <div className="flex flex-col gap-14">
          {view.shown.map((currency) => {
            const accts = accounts.filter((a) => a.currency === currency);
            if (accts.length === 0) return null;
            return (
              <CurrencySection
                key={currency}
                currency={currency}
                accounts={accts}
                holdings={holdings}
                flows={flows.filter((f) => f.currency === currency)}
                stats={contributions[currency]}
                showHeading={view.shown.length > 1}
              />
            );
          })}
        </div>
      )}
    </>
  );
}

function CurrencySection({
  currency,
  accounts,
  holdings,
  flows,
  stats,
  showHeading,
}: {
  currency: Currency;
  accounts: InvestmentAccount[];
  holdings: PortfolioHolding[];
  flows: FlowItem[];
  stats?: ContributionStats;
  showHeading: boolean;
}) {
  const ids = new Set(accounts.map((a) => a.id));
  const mine = holdings.filter((h) => ids.has(h.account_id));
  const totals = summarizePortfolio(accounts, holdings);
  const slices = allocation(accounts, holdings);
  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
  const updated = accounts
    .map((a) => a.balance_as_of)
    .filter((d): d is string => Boolean(d))
    .sort()
    .pop();

  const up = totals.gain >= 0;
  const gainTone = totals.gain === 0 ? "" : up ? "text-positive" : "text-negative";

  return (
    <section aria-label={CURRENCY_NAME[currency]} className="flex flex-col gap-6">
      {showHeading && (
        <h2 className="flex items-baseline gap-3 text-2xl font-semibold tracking-[-0.03em]">
          {CURRENCY_NAME[currency]}
          <span className="font-mono text-xs font-normal uppercase tracking-wider text-muted">{currency}</span>
        </h2>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total value today" value={formatMoney(totals.totalValue, currency)}>
          <span className="text-sm text-muted">{updated ? `Updated ${timeAgo(updated)}` : " "}</span>
        </Stat>
        <Stat label="Invested" value={formatMoney(totals.costBasis, currency)}>
          <span className="text-sm text-muted">What you paid for your holdings</span>
        </Stat>
        <Stat
          label={totals.gain < 0 ? "Loss" : "Gain"}
          value={totals.costBasis > 0 ? signed(totals.gain, currency) : "—"}
          tone={gainTone}
        >
          <span className="text-sm text-muted">
            {totals.gainPct === null ? "No cost to compare with" : `${pct(totals.gainPct)} on what you paid`}
          </span>
        </Stat>
        <Stat label="Contributed this month" value={formatMoney(stats?.thisMonth ?? 0, currency)}>
          <span className="text-sm text-muted">
            {stats && stats.payrollThisMonth > 0
              ? `${formatMoneyWhole(stats.payrollThisMonth, currency)} through payroll`
              : `${formatMoneyWhole(stats?.last12 ?? 0, currency)} in 12 months`}
          </span>
        </Stat>
      </div>

      {totals.missingBasis > 0 && (
        <p className="rounded-2xl border border-line bg-surface px-5 py-3.5 text-sm text-muted">
          <span className="font-medium text-warn">
            {totals.missingBasis} holding{totals.missingBasis === 1 ? "" : "s"}
          </span>{" "}
          {totals.missingBasis === 1 ? "doesn’t" : "don’t"} report what you paid, so{" "}
          {totals.missingBasis === 1 ? "it isn’t" : "they aren’t"} included in the gain or loss
          above.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="What you hold" subtitle="Share of your total value by kind of asset.">
          {slices.length === 0 ? (
            <p className="text-muted">No holdings yet.</p>
          ) : (
            <div className="flex flex-col items-center gap-6 @lg:flex-row">
              <DonutChart
                slices={slices}
                currency={currency}
                centerLabel="Value"
                centerValue={formatMoneyWhole(totals.totalValue, currency)}
              />
              <DonutLegend slices={slices} currency={currency} />
            </div>
          )}
        </Card>

        <Card title="Accounts" subtitle="Where it is, and whether deposits come from your paycheck.">
          <ul className="divide-y divide-line">
            {accounts.map((a) => {
              const t = summarizePortfolio([a], holdings);
              return (
                <li key={a.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.name}</p>
                      <p className="truncate text-sm text-muted">
                        {a.institution ? `${a.institution} · ` : ""}
                        {subtypeLabel(a.subtype)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-medium tabular-nums">{formatMoney(t.totalValue, currency)}</p>
                      {t.gainPct !== null && (
                        <p className={`text-sm tabular-nums ${t.gain < 0 ? "text-negative" : "text-positive"}`}>
                          <span aria-hidden>{t.gain === 0 ? "" : t.gain > 0 ? "▲ " : "▼ "}</span>
                          {formatMoneyWhole(Math.abs(t.gain), currency)} ({pct(t.gainPct)})
                        </p>
                      )}
                    </div>
                  </div>
                  <PayrollToggle id={a.id} checked={a.payroll_funded} />
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card title="Holdings" subtitle="Every position, biggest first. Values are as of the last sync.">
        {mine.length === 0 ? (
          <p className="text-muted">No holdings yet. They appear after the first sync.</p>
        ) : (
          <HoldingsTable holdings={mine} accountNames={accountNames} currency={currency} />
        )}
      </Card>

      <Card
        title="Contributions"
        subtitle="Money going into these accounts. Deposits into accounts marked as paycheck-funded are added to your income on the Overview, because they left your paycheck before it reached your bank."
      >
        <dl className="mb-5 flex flex-wrap gap-x-10 gap-y-3 text-sm">
          <div>
            <dt className="text-muted">This month</dt>
            <dd className="mt-0.5 text-base font-medium">{formatMoney(stats?.thisMonth ?? 0, currency)}</dd>
          </div>
          <div>
            <dt className="text-muted">Past 12 months</dt>
            <dd className="mt-0.5 text-base font-medium">{formatMoney(stats?.last12 ?? 0, currency)}</dd>
          </div>
          <div>
            <dt className="text-muted">Through payroll, past 12 months</dt>
            <dd className="mt-0.5 text-base font-medium">{formatMoney(stats?.payroll12 ?? 0, currency)}</dd>
          </div>
        </dl>

        {flows.length === 0 ? (
          <p className="text-muted">No deposits found yet.</p>
        ) : (
          <>
            <h3 className="mb-1 font-mono text-xs uppercase tracking-wider text-muted">Recent deposits</h3>
            <ul className="divide-y divide-line">
              {flows.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate">{f.description ?? "Deposit"}</p>
                    <p className="truncate text-sm text-muted">
                      {formatDay(f.posted_date)} &middot; {f.accountName}
                      {f.payrollFunded ? " · From paycheck" : ""}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums text-positive">+{formatMoney(f.amount, currency)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </section>
  );
}
