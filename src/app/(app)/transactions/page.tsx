import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { secondaryButtonClass } from "@/components/form-styles";
import { PageHeader } from "@/components/page-header";
import type { Currency } from "@/lib/accounts";
import { createClient } from "@/lib/supabase/server";
import {
  PAGE_SIZE,
  monthRange,
  type Category,
  type Tx,
} from "@/lib/transactions";
import { AddTransaction } from "./add-transaction";
import { AutoCategorizeButton } from "./auto-categorize-button";
import { FilterBar, type Filters } from "./filter-bar";
import { TransactionList } from "./transaction-list";

// Server actions started from this page (auto-categorize) get the longest request time.
export const maxDuration = 60;

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

// PostgREST treats these as syntax inside an .or() filter.
const cleanSearch = (q: string) => q.replace(/[%,()*\\]/g, " ").trim();

export type MealCandidate = {
  id: string;
  posted_date: string;
  description: string;
  merchant: string | null;
  amount: number;
  account: { currency: Currency };
  category: { name: string } | null;
};

export default async function Transactions({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const filters: Filters = {
    q: first(sp.q).trim(),
    account: first(sp.account),
    category: first(sp.category),
    month: first(sp.month),
    trip: first(sp.trip),
    from: isDate(first(sp.from)) ? first(sp.from) : "",
    to: isDate(first(sp.to)) ? first(sp.to) : "",
  };
  // Set by the Overview's "looks like you traveled" banner: purchases made
  // abroad that aren't already accounted for by a trip.
  const foreignOnly = first(sp.foreign) === "1";
  const page = Math.max(1, Number.parseInt(first(sp.page), 10) || 1);

  const supabase = await createClient();

  const [accountsRes, categoriesRes, waitingRes, tripsRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, currency")
      .eq("closed", false)
      .order("name"),
    supabase
      .from("categories")
      .select("id, name, kind, sort_order")
      .order("sort_order"),
    // Transactions still waiting for a best-guess category.
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .is("category_id", null)
      .eq("category_source", "auto"),
    supabase.from("trips").select("id, name").order("created_at"),
  ]);
  const waiting = waitingRes.count ?? 0;
  const accounts = (accountsRes.data ?? []) as {
    id: string;
    name: string;
    currency: Currency;
  }[];
  const categories = (categoriesRes.data ?? []) as Category[];
  const trips = (tripsRes.data ?? []) as { id: string; name: string }[];

  let query = supabase
    .from("transactions")
    .select(
      "id, posted_date, description, merchant, amount, pending, notes, category_id, category_source, source, account:accounts(id, name, currency), category:categories!transactions_category_id_fkey(id, name, kind), trip_id, trip:trips(id, name)",
      { count: "exact" },
    )
    .order("posted_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  // A custom date range is more specific than the month picker, so it wins
  // when both are somehow present.
  if (filters.from || filters.to) {
    if (filters.from) query = query.gte("posted_date", filters.from);
    if (filters.to) query = query.lte("posted_date", filters.to);
  } else {
    const range = monthRange(filters.month);
    if (range) query = query.gte("posted_date", range.from).lt("posted_date", range.to);
  }
  if (filters.account) query = query.eq("account_id", filters.account);
  if (filters.category === "none") query = query.is("category_id", null);
  else if (filters.category) query = query.eq("category_id", filters.category);
  if (filters.trip === "none") query = query.is("trip_id", null);
  else if (filters.trip) query = query.eq("trip_id", filters.trip);
  if (foreignOnly) query = query.not("country", "is", null).is("trip_id", null);
  const q = cleanSearch(filters.q);
  if (q) query = query.or(`description.ilike.%${q}%,merchant.ilike.%${q}%`);

  const { data, count, error } = await query;
  const transactions = (data ?? []) as unknown as Tx[];
  const transactionIds = transactions.map((tx) => tx.id);
  const [{ data: links }, { data: meals }] = await Promise.all([
    transactionIds.length
      ? supabase
          .from("transaction_reimbursements")
          .select("id, reimbursement_transaction_id, amount, expense:transactions!transaction_reimbursements_expense_transaction_id_fkey(id, posted_date, description, merchant, amount, category:categories!transactions_category_id_fkey(name))")
          .in("reimbursement_transaction_id", transactionIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("transactions")
      .select("id, posted_date, description, merchant, amount, account:accounts(currency), category:categories!transactions_category_id_fkey!inner(name, kind)")
      .lt("amount", 0)
      .eq("category.kind", "expense")
      .order("posted_date", { ascending: false })
      .limit(30),
  ]);
  const linkByReimbursement = new Map(
    (links ?? []).map((link) => [link.reimbursement_transaction_id, link]),
  );
  for (const tx of transactions) {
    const link = linkByReimbursement.get(tx.id);
    if (link) tx.reimbursement = {
      id: link.id,
      amount: Number(link.amount),
      expense: link.expense as unknown as NonNullable<Tx["reimbursement"]>["expense"],
    };
  }
  const mealCandidates = (meals ?? []) as unknown as MealCandidate[];

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showCurrency = new Set(accounts.map((a) => a.currency)).size > 1;
  const filtered = Object.values(filters).some(Boolean);

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return `/transactions${s ? `?${s}` : ""}`;
  };

  // Group consecutive rows by day.
  const days: { date: string; items: Tx[] }[] = [];
  for (const tx of transactions) {
    const last = days[days.length - 1];
    if (last?.date === tx.posted_date) last.items.push(tx);
    else days.push({ date: tx.posted_date, items: [tx] });
  }

  if (accountsRes.error || categoriesRes.error || error) {
    return (
      <>
        <PageHeader title="Transactions" />
        <p role="alert" className="text-negative">
          Couldn&rsquo;t load your transactions. Refresh to try again.
        </p>
      </>
    );
  }

  if (accounts.length === 0) {
    return (
      <>
        <PageHeader title="Transactions" />
        <EmptyState
          title="Add an account first"
          description="Transactions belong to an account. Connect a bank or add one by hand, then your activity shows up here."
        >
          <Link
            href="/accounts"
            className="mt-4 rounded-full bg-foreground px-6 py-3 font-medium text-surface transition-opacity hover:opacity-85"
          >
            Go to accounts
          </Link>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        description={
          total > 0
            ? `${total.toLocaleString("en-US")} ${filtered ? "matching " : ""}transaction${total === 1 ? "" : "s"}. Tap one to change its category or add a note.`
            : undefined
        }
      />

      <div className="mb-6 flex flex-wrap items-start gap-3">
        <AddTransaction accounts={accounts} categories={categories} />
        <Link href="/transactions/import" className={secondaryButtonClass}>
          Import CSV
        </Link>
        {trips.length > 0 && (
          <Link href="/trips" className={secondaryButtonClass}>
            Trips
          </Link>
        )}
        {waiting > 0 && <AutoCategorizeButton count={waiting} />}
      </div>

      <FilterBar filters={filters} accounts={accounts} categories={categories} trips={trips} />

      {transactions.length === 0 ? (
        <EmptyState
          title={filtered ? "Nothing matches" : "No transactions yet"}
          description={
            filtered
              ? "Try a different search or clear the filters."
              : "Import a CSV from your bank, add one by hand, or connect a bank on the Accounts page."
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          <TransactionList
            days={days}
            categories={categories}
            mealCandidates={mealCandidates}
            showCurrency={showCurrency}
            trips={trips}
          />

          {pages > 1 && (
            <nav aria-label="Pages" className="flex items-center justify-between gap-3">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className={secondaryButtonClass}>
                  &larr; Newer
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-muted">
                Page {page} of {pages}
              </span>
              {page < pages ? (
                <Link href={pageHref(page + 1)} className={secondaryButtonClass}>
                  Older &rarr;
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>
      )}
    </>
  );
}
