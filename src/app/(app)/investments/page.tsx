import { PageHeader } from "@/components/page-header";
import type { Currency } from "@/lib/accounts";
import type { PortfolioHolding } from "@/lib/portfolio";
import { buildSeries, monthsEndingAt } from "@/lib/spending";
import { fetchAggRows, fetchPayroll } from "@/lib/spending-data";
import { createClient } from "@/lib/supabase/server";
import { currentMonth } from "@/lib/transactions";
import { resolveCurrencyView } from "@/lib/view-params";
import {
  PortfolioView,
  type ContributionStats,
  type FlowItem,
  type InvestmentAccount,
} from "./portfolio-view";

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export default async function Investments({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const month = currentMonth();
  const months12 = monthsEndingAt(month, 12);
  const supabase = await createClient();

  // Row-level security limits every query here to your own data.
  const [accountsRes, flowsRes, agg, payroll] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, institution, subtype, currency, payroll_funded, balance_current, balance_as_of")
      .eq("type", "investment")
      .order("name"),
    supabase
      .from("investment_flows")
      .select("id, posted_date, amount, description, account:accounts(name, currency, payroll_funded)")
      .order("posted_date", { ascending: false })
      .limit(40),
    fetchAggRows(supabase, months12),
    fetchPayroll(supabase, months12),
  ]);

  if (accountsRes.error || flowsRes.error || !agg || !payroll) {
    return (
      <>
        <PageHeader title="Investments" />
        <p role="alert" className="text-negative">
          Couldn&rsquo;t load your investments. Refresh to try again.
        </p>
      </>
    );
  }

  const accounts: InvestmentAccount[] = (accountsRes.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    institution: a.institution,
    subtype: a.subtype,
    currency: a.currency as Currency,
    payroll_funded: a.payroll_funded,
    balance_current: num(a.balance_current),
    balance_as_of: a.balance_as_of,
  }));

  // Holdings in pages: the API returns at most 1000 rows at a time.
  const holdings: PortfolioHolding[] = [];
  if (accounts.length > 0) {
    for (let offset = 0; offset < 20_000; offset += 1000) {
      const { data, error } = await supabase
        .from("holdings")
        .select("id, account_id, ticker, name, security_type, quantity, cost_basis, price, market_value")
        .order("id")
        .range(offset, offset + 999);
      if (error) {
        return (
          <>
            <PageHeader title="Investments" />
            <p role="alert" className="text-negative">
              Couldn&rsquo;t load your holdings. Refresh to try again.
            </p>
          </>
        );
      }
      holdings.push(
        ...(data ?? []).map((h) => ({
          id: h.id,
          account_id: h.account_id,
          ticker: h.ticker,
          name: h.name,
          security_type: h.security_type,
          quantity: Number(h.quantity),
          cost_basis: num(h.cost_basis),
          price: num(h.price),
          market_value: num(h.market_value),
        })),
      );
      if ((data ?? []).length < 1000) break;
    }
  }

  const currencies = [...new Set(accounts.map((a) => a.currency))];
  const view = resolveCurrencyView(first(sp.cur), currencies);

  // Contributions are what the Overview counts: transfers from your bank plus
  // deposits into paycheck-funded accounts, so the two pages always agree.
  const contributions: Partial<Record<Currency, ContributionStats>> = {};
  for (const currency of currencies) {
    const s = buildSeries(agg, currency, months12, payroll);
    const sum = (r: Record<string, number>) => months12.reduce((t, m) => t + (r[m] ?? 0), 0);
    contributions[currency] = {
      thisMonth: s.invested[month] ?? 0,
      payrollThisMonth: s.payroll[month] ?? 0,
      last12: Math.round(sum(s.invested) * 100) / 100,
      payroll12: Math.round(sum(s.payroll) * 100) / 100,
    };
  }

  const flows: FlowItem[] = (flowsRes.data ?? []).map((f) => {
    // The joined account comes back as a single object.
    const acct = f.account as unknown as { name: string; currency: Currency; payroll_funded: boolean };
    return {
      id: f.id,
      posted_date: f.posted_date,
      amount: Number(f.amount),
      description: f.description,
      accountName: acct.name,
      payrollFunded: acct.payroll_funded,
      currency: acct.currency,
    };
  });

  return (
    <PortfolioView
      view={view}
      accounts={accounts}
      holdings={holdings}
      flows={flows}
      contributions={contributions}
      confirmNew={process.env.PLAID_ENV === "production"}
    />
  );
}
