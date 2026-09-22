"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  compactInputClass,
  compactPrimaryClass,
  compactSecondaryClass,
} from "@/components/form-styles";
import type { Currency } from "@/lib/accounts";
import { formatDay, formatMoney } from "@/lib/transactions";
import { deleteTrip, renameTrip, type TripFormState } from "./trip-actions";

export type TripSummary = {
  id: string;
  name: string;
  /** One entry per currency the trip has spending in; empty until something's attached. */
  currencies: {
    currency: Currency;
    /** What you paid out, before reimbursements. */
    spent: number;
    /** Zelle/cash settle-ups attached to the trip. */
    reimbursed: number;
    /** spent - reimbursed: what the trip actually cost you. */
    net: number;
    count: number;
    from: string;
    to: string;
  }[];
};

const initial: TripFormState = {};

export function TripList({ trips }: { trips: TripSummary[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {trips.map((t) => (
        <TripCard key={t.id} trip={t} />
      ))}
    </ul>
  );
}

function TripCard({ trip }: { trip: TripSummary }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [renameState, renameAction, renaming] = useActionState(renameTrip, initial);
  const [deleteState, deleteAction, deleting] = useActionState(deleteTrip, initial);

  useEffect(() => {
    if (!renameState.ok) return;
    setEditing(false);
    router.refresh();
  }, [renameState, router]);

  useEffect(() => {
    if (deleteState.ok) router.refresh();
  }, [deleteState, router]);

  if (editing) {
    return (
      <li className="rounded-2xl border border-line bg-surface px-4 py-3.5">
        <form action={renameAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={trip.id} />
          <input
            name="name"
            defaultValue={trip.name}
            maxLength={80}
            autoFocus
            className={`${compactInputClass} min-w-0 flex-1`}
          />
          <button type="submit" disabled={renaming} className={compactPrimaryClass}>
            {renaming ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className={compactSecondaryClass}
          >
            Cancel
          </button>
        </form>
        {renameState.error && (
          <p role="alert" className="mt-1.5 text-sm text-negative">
            {renameState.error}
          </p>
        )}
      </li>
    );
  }

  return (
    <li className="rounded-2xl border border-line bg-surface px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/trips/${trip.id}`} className="min-w-0 flex-1 hover:underline">
          <p className="truncate font-medium">{trip.name}</p>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-raised hover:text-foreground"
          >
            Rename
          </button>
          <form
            action={deleteAction}
            onSubmit={(e) => {
              if (
                !window.confirm(
                  `Delete the "${trip.name}" trip? Its transactions stay -- they'll just go back to the category they had before the trip.`,
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={trip.id} />
            <button
              type="submit"
              disabled={deleting}
              className="rounded-full px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-raised hover:text-negative"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </form>
        </div>
      </div>

      {deleteState.error && (
        <p role="alert" className="mt-1 text-sm text-negative">
          {deleteState.error}
        </p>
      )}

      {trip.currencies.length === 0 ? (
        <p className="mt-1 text-sm text-muted">No transactions yet.</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-0.5">
          {trip.currencies.map((c) => (
            <li key={c.currency} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-muted">
                {formatDay(c.from)} &ndash; {formatDay(c.to)} &middot; {c.count} transaction
                {c.count === 1 ? "" : "s"}
                {c.reimbursed > 0 && (
                  <>
                    {" "}
                    &middot; {formatMoney(c.reimbursed, c.currency)} reimbursed
                  </>
                )}
              </span>
              <span className="shrink-0 tabular-nums">{formatMoney(c.net, c.currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
