"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { compactInputClass } from "@/components/form-styles";
import { formatMonthLabel, monthRange, type Category } from "@/lib/transactions";
import { filtersQuery, hasFilters, type Filters } from "./filters";

type ListKey = "account" | "category" | "trip";
type Option = { id: string; name: string };

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const sameYear = y === new Date().getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
};

function dateLabel(f: Filters) {
  if (f.from && f.to) return f.from === f.to ? shortDate(f.from) : `${shortDate(f.from)} – ${shortDate(f.to)}`;
  if (f.from) return `From ${shortDate(f.from)}`;
  if (f.to) return `Until ${shortDate(f.to)}`;
  if (f.month && monthRange(f.month)) return formatMonthLabel(f.month);
  return null;
}

function listLabel(selected: string[], options: Option[], plural: string) {
  if (selected.length === 0) return null;
  if (selected.length === 1) return options.find((o) => o.id === selected[0])?.name ?? `1 ${plural.slice(0, -1)}`;
  return `${selected.length} ${plural}`;
}

export function FilterBar({
  filters,
  accounts,
  categories,
  trips,
}: {
  filters: Filters;
  accounts: Option[];
  categories: Category[];
  trips: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<string | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  // Local copy so checkboxes respond instantly; re-synced whenever the URL changes.
  const [draft, setDraft] = useState(filters);
  const filtersKey = filtersQuery(filters).toString();
  const [syncedKey, setSyncedKey] = useState(filtersKey);
  if (filtersKey !== syncedKey) {
    setSyncedKey(filtersKey);
    setDraft(filters);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const apply = (next: Filters) => {
    setDraft(next);
    const s = filtersQuery(next).toString();
    startTransition(() => router.push(`${pathname}${s ? `?${s}` : ""}`, { scroll: false }));
  };

  const toggle = (key: ListKey, id: string) => {
    const list = draft[key];
    apply({ ...draft, [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
  };

  const setDate = (patch: Partial<Pick<Filters, "from" | "to">>) => {
    // Picking dates replaces a month that came from another page's link.
    const range = monthRange(draft.month);
    const base = draft.from || draft.to || !range ? draft : { ...draft, from: range.from, to: lastDay(range.to) };
    apply({ ...base, ...patch, month: "" });
  };

  const accountOptions = accounts;
  const categoryOptions: Option[] = [{ id: "none", name: "Uncategorized" }, ...categories];
  const tripOptions: Option[] = [...trips, { id: "none", name: "Not on a trip" }];
  const monthDates = monthRange(draft.month);
  const fromValue = draft.from || (!draft.to && monthDates ? monthDates.from : "");
  const toValue = draft.to || (!draft.from && monthDates ? lastDay(monthDates.to) : "");

  return (
    <div className={`mb-6 flex flex-col gap-3 lg:flex-row lg:items-center ${pending ? "opacity-80" : ""}`}>
      <form
        role="search"
        className="lg:min-w-0 lg:flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          apply({ ...draft, q: draft.q.trim() });
        }}
      >
        <input
          type="search"
          value={draft.q}
          onChange={(e) => {
            const q = e.target.value;
            // Clearing the box (or its × button) shows everything again right away.
            if (!q && filters.q) apply({ ...draft, q: "" });
            else setDraft({ ...draft, q });
          }}
          placeholder="Search transactions"
          aria-label="Search transactions"
          className={compactInputClass}
        />
      </form>

      <div ref={rowRef} className="relative flex min-w-0 items-center gap-2">
        <MultiSelect
          id="account"
          label="Account"
          summary={listLabel(draft.account, accountOptions, "accounts")}
          options={accountOptions}
          selected={draft.account}
          open={open}
          setOpen={setOpen}
          onToggle={(id) => toggle("account", id)}
          onClear={() => apply({ ...draft, account: [] })}
        />
        <MultiSelect
          id="category"
          label="Category"
          summary={listLabel(draft.category, categoryOptions, "categories")}
          options={categoryOptions}
          selected={draft.category}
          open={open}
          setOpen={setOpen}
          onToggle={(id) => toggle("category", id)}
          onClear={() => apply({ ...draft, category: [] })}
        />
        {trips.length > 0 && (
          <MultiSelect
            id="trip"
            label="Trip"
            summary={listLabel(draft.trip, tripOptions, "trips")}
            options={tripOptions}
            selected={draft.trip}
            open={open}
            setOpen={setOpen}
            onToggle={(id) => toggle("trip", id)}
            onClear={() => apply({ ...draft, trip: [] })}
          />
        )}
        <Pill id="date" label="Date" summary={dateLabel(draft)} open={open} setOpen={setOpen} shrink={false}>
          <div className="flex flex-col gap-3 p-3">
            <label className="flex flex-col gap-1 text-sm text-muted">
              From
              <input
                type="date"
                value={fromValue}
                max={toValue || undefined}
                onChange={(e) => setDate({ from: e.target.value })}
                className={compactInputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted">
              To
              <input
                type="date"
                value={toValue}
                min={fromValue || undefined}
                onChange={(e) => setDate({ to: e.target.value })}
                className={compactInputClass}
              />
            </label>
            {(draft.from || draft.to || draft.month) && (
              <button
                type="button"
                onClick={() => apply({ ...draft, from: "", to: "", month: "" })}
                className="self-start text-sm font-medium text-muted underline underline-offset-4 hover:text-foreground"
              >
                Any date
              </button>
            )}
          </div>
        </Pill>

        {hasFilters(draft) && (
          <button
            type="button"
            aria-label="Clear filters"
            title="Clear filters"
            onClick={() => {
              setOpen(null);
              apply({ q: "", account: [], category: [], trip: [], month: "", from: "", to: "" });
            }}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-raised hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden className="h-4 w-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/** `to` from monthRange is exclusive; date inputs want the last day itself. */
function lastDay(exclusiveTo: string) {
  const [y, m, d] = exclusiveTo.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d - 1));
  return date.toISOString().slice(0, 10);
}

function Pill({
  id,
  label,
  summary,
  open,
  setOpen,
  shrink = true,
  children,
}: {
  id: string;
  label: string;
  summary: string | null;
  open: string | null;
  setOpen: (id: string | null) => void;
  shrink?: boolean;
  children: ReactNode;
}) {
  const isOpen = open === id;
  const active = summary !== null;
  return (
    // On phones the panel spans the whole row; on wider screens it hangs under its pill.
    <div className={`min-w-0 sm:relative ${shrink ? "shrink" : "shrink-0"}`}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={`filter-${id}`}
        aria-label={active ? `${label}: ${summary}` : label}
        onClick={() => setOpen(isOpen ? null : id)}
        className={`flex h-9 max-w-full items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors ${
          active
            ? "border-foreground bg-foreground text-surface"
            : "border-line bg-surface text-foreground hover:bg-raised"
        }`}
      >
        <span className="truncate">{summary ?? label}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {isOpen && (
        <div
          id={`filter-${id}`}
          className="absolute inset-x-0 top-full z-20 mt-2 rounded-2xl border border-line bg-surface shadow-[0_8px_30px_-8px_rgba(14,21,18,0.25)] sm:inset-x-auto sm:left-0 sm:w-72"
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MultiSelect({
  options,
  selected,
  onToggle,
  onClear,
  ...pill
}: {
  id: string;
  label: string;
  summary: string | null;
  options: Option[];
  selected: string[];
  open: string | null;
  setOpen: (id: string | null) => void;
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <Pill {...pill}>
      <ul className="max-h-72 overflow-y-auto p-1.5" aria-label={pill.label}>
        {options.map((o) => (
          <li key={o.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9375rem] hover:bg-raised">
              <input
                type="checkbox"
                checked={selected.includes(o.id)}
                onChange={() => onToggle(o.id)}
                className="h-4 w-4 shrink-0 accent-foreground"
              />
              <span className="truncate">{o.name}</span>
            </label>
          </li>
        ))}
      </ul>
      {selected.length > 0 && (
        <div className="border-t border-line px-4 py-2.5">
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-medium text-muted underline underline-offset-4 hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}
    </Pill>
  );
}
