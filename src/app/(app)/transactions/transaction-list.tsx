"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  compactInputClass,
  compactPrimaryClass,
  compactSecondaryClass,
} from "@/components/form-styles";
import { formatDay, type Category, type Tx } from "@/lib/transactions";
import type { MealCandidate } from "./page";
import { TransactionRow } from "./transaction-row";
import { attachToTrip, type TripFormState } from "../trips/trip-actions";

const initial: TripFormState = {};

export function TransactionList({
  days,
  categories,
  mealCandidates,
  showCurrency,
  trips,
}: {
  days: { date: string; items: Tx[] }[];
  categories: Category[];
  mealCandidates: MealCandidate[];
  showCurrency: boolean;
  trips: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tripId, setTripId] = useState("");
  const [state, action, pending] = useActionState(attachToTrip, initial);

  useEffect(() => {
    if (state.ok) {
      setSelected(new Set());
      setTripId("");
      router.refresh();
    }
  }, [state, router]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <div className="flex flex-col gap-6">
        {days.map((day) => (
          <section key={day.date}>
            <h2 className="mb-2 font-mono text-xs uppercase tracking-wider text-muted">
              {formatDay(day.date)}
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {day.items.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  categories={categories}
                  mealCandidates={mealCandidates}
                  showCurrency={showCurrency}
                  selectable={trips.length > 0}
                  selected={selected.has(tx.id)}
                  onToggleSelect={() => toggle(tx.id)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {trips.length > 0 && selected.size > 0 && (
        <form
          action={action}
          className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-[0_8px_30px_-8px_rgba(14,21,18,0.25)]"
        >
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="id" value={id} />
          ))}
          <span className="text-sm font-medium">{selected.size} selected</span>
          <select
            name="trip_id"
            value={tripId}
            onChange={(e) => setTripId(e.target.value)}
            aria-label="Trip"
            className={`${compactInputClass} w-auto flex-1`}
          >
            <option value="">Add to trip...</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={pending || !tripId} className={compactPrimaryClass}>
            {pending ? "Attaching…" : "Attach"}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className={compactSecondaryClass}
          >
            Clear
          </button>
          {state.error && (
            <p role="alert" className="w-full text-sm text-negative">
              {state.error}
            </p>
          )}
        </form>
      )}
    </>
  );
}
