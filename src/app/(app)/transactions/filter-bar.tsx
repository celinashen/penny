"use client";

import Link from "next/link";
import { compactInputClass } from "@/components/form-styles";
import type { Category } from "@/lib/transactions";

export type Filters = { q: string; account: string; category: string; month: string };

/** A plain GET form: filters live in the URL, so they can be bookmarked and shared. */
export function FilterBar({
  filters,
  accounts,
  categories,
}: {
  filters: Filters;
  accounts: { id: string; name: string }[];
  categories: Category[];
}) {
  const active = Object.values(filters).some(Boolean);

  return (
    <form
      method="get"
      action="/transactions"
      // Selects and the month picker apply immediately; search waits for Enter.
      onChange={(e) => {
        const t = e.target;
        if (
          t instanceof HTMLSelectElement ||
          (t instanceof HTMLInputElement && t.type === "month")
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

      <input
        type="month"
        name="month"
        defaultValue={filters.month}
        aria-label="Month"
        className={compactInputClass}
      />

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
