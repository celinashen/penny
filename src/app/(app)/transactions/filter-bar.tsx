"use client";

import Link from "next/link";
import { compactInputClass } from "@/components/form-styles";
import type { Category } from "@/lib/transactions";

export type Filters = {
  q: string;
  account: string;
  category: string;
  month: string;
  trip: string;
  from: string;
  to: string;
};

/** A plain GET form: filters live in the URL, so they can be bookmarked and shared. */
export function FilterBar({
  filters,
  accounts,
  categories,
  trips,
}: {
  filters: Filters;
  accounts: { id: string; name: string }[];
  categories: Category[];
  trips: { id: string; name: string }[];
}) {
  const active = Object.values(filters).some(Boolean);

  return (
    <form
      method="get"
      action="/transactions"
      // Selects and the date pickers apply immediately; search waits for Enter.
      onChange={(e) => {
        const t = e.target;
        if (
          t instanceof HTMLSelectElement ||
          (t instanceof HTMLInputElement && t.type === "date")
        ) {
          e.currentTarget.requestSubmit();
        }
      }}
      className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <input
        type="search"
        name="q"
        defaultValue={filters.q}
        placeholder="Search transactions"
        aria-label="Search transactions"
        className={`${compactInputClass} sm:col-span-2 lg:col-span-4`}
      />

      <select name="account" defaultValue={filters.account} aria-label="Account" className={compactInputClass}>
        <option value="">All accounts</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      <select name="category" defaultValue={filters.category} aria-label="Category" className={compactInputClass}>
        <option value="">All categories</option>
        <option value="none">Uncategorized</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-2">
        <input
          type="date"
          name="from"
          defaultValue={filters.from}
          aria-label="From date"
          max={filters.to || undefined}
          className={`${compactInputClass} min-w-0 flex-1`}
        />
        <span className="shrink-0 text-sm text-muted">to</span>
        <input
          type="date"
          name="to"
          defaultValue={filters.to}
          aria-label="To date"
          min={filters.from || undefined}
          className={`${compactInputClass} min-w-0 flex-1`}
        />
      </div>

      {trips.length > 0 && (
        <select name="trip" defaultValue={filters.trip} aria-label="Trip" className={compactInputClass}>
          <option value="">All trips</option>
          {trips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}

      {active ? (
        <Link
          href="/transactions"
          className="grid h-11 place-items-center rounded-xl border border-line bg-surface text-sm font-medium transition-colors hover:bg-raised"
        >
          Clear filters
        </Link>
      ) : (
        <span aria-hidden className="hidden lg:block" />
      )}
    </form>
  );
}
