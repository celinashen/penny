import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Stat } from "@/components/stat";
import type { Currency } from "@/lib/accounts";
import { createClient } from "@/lib/supabase/server";
import { formatDay, formatMoney } from "@/lib/transactions";
import { fetchTripTransactions } from "../trip-summary";
import { TripHeader } from "./trip-header";

export default async function TripDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // Row-level security means this only finds a trip that's yours.
  const { data: trip } = await supabase.from("trips").select("id, name").eq("id", id).maybeSingle();

  if (!trip) {
    return (
      <>
        <Link
          href="/trips"
          className="mb-4 inline-block text-sm text-muted transition-colors hover:text-foreground"
        >
          &larr; Trips
        </Link>
        <PageHeader title="Trip not found" />
        <EmptyState
          title="Couldn’t find that trip"
          description="It may have been deleted, or the link is wrong."
        />
      </>
    );
  }

  const transactions = await fetchTripTransactions(supabase, id);

  const byCurrency = new Map<
    Currency,
    { currency: Currency; spent: number; reimbursed: number; count: number; from: string; to: string }
  >();
  for (const t of transactions) {
    const currency = t.account.currency;
    const entry = byCurrency.get(currency) ?? {
      currency,
      spent: 0,
      reimbursed: 0,
      count: 0,
      from: t.posted_date,
      to: t.posted_date,
    };
    if (t.amount < 0) entry.spent += -t.amount;
    else entry.reimbursed += t.amount;
    entry.count += 1;
    if (t.posted_date < entry.from) entry.from = t.posted_date;
    if (t.posted_date > entry.to) entry.to = t.posted_date;
    byCurrency.set(currency, entry);
  }
  const currencies = [...byCurrency.values()];

  return (
    <>
      <Link
        href="/trips"
        className="mb-4 inline-block text-sm text-muted transition-colors hover:text-foreground"
      >
        &larr; Trips
      </Link>
      <PageHeader title={trip.name} />
      <TripHeader id={trip.id} name={trip.name} />

      {transactions.length === 0 ? (
        <EmptyState
          title="Nothing attached yet"
          description="Select transactions on the Transactions page and attach them to this trip."
        >
          <Link
            href="/transactions"
            className="mt-4 rounded-full bg-foreground px-6 py-3 font-medium text-surface transition-opacity hover:opacity-85"
          >
            Go to Transactions
          </Link>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {currencies.map((c) => (
              <Stat
                key={c.currency}
                label={currencies.length > 1 ? `Net cost (${c.currency})` : "Net cost"}
                value={formatMoney(c.spent - c.reimbursed, c.currency)}
              >
                <span className="text-sm text-muted">
                  {c.count} transaction{c.count === 1 ? "" : "s"} &middot; {formatDay(c.from)}
                  {" – "}
                  {formatDay(c.to)}
                  {c.reimbursed > 0 && (
                    <>
                      {" "}
                      &middot; {formatMoney(c.reimbursed, c.currency)} reimbursed
                    </>
                  )}
                </span>
              </Stat>
            ))}
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-[-0.02em]">Transactions</h2>
              <Link
                href={`/transactions?trip=${trip.id}`}
                className="text-sm font-medium underline underline-offset-4 hover:text-accent"
              >
                View &amp; edit in Transactions &rarr;
              </Link>
            </div>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {transactions.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.merchant || t.description}</p>
                    <p className="truncate text-sm text-muted">
                      {formatDay(t.posted_date)} &middot; {t.account.name}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 tabular-nums ${t.amount > 0 ? "font-medium text-positive" : ""}`}
                  >
                    {formatMoney(t.amount, t.account.currency, true)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
