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
import { formatDay, formatMoney, formatMoneyWhole } from "@/lib/transactions";
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
    <ul className="grid gap-4 sm:grid-cols-2">
      {trips.map((t) => (
        <TripCard key={t.id} trip={t} />
      ))}
    </ul>
  );
}

const chevron = (open: boolean) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className={`h-5 w-5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

function TripCard({ trip }: { trip: TripSummary }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
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

  const primary = trip.currencies[0];
  const totalCount = trip.currencies.reduce((t, c) => t + c.count, 0);
  const from = trip.currencies.reduce<string | null>(
    (min, c) => (min === null || c.from < min ? c.from : min),
    null,
  );
  const to = trip.currencies.reduce<string | null>(
    (max, c) => (max === null || c.to > max ? c.to : max),
    null,
  );

  if (editing) {
    return (
      <li className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
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
    <li className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold tracking-[-0.01em]">{trip.name}</p>
          <p className="mt-1 truncate text-sm text-muted">
            {from && to ? (
              <>
                {formatDay(from)} &ndash; {formatDay(to)} &middot; {totalCount} transaction
                {totalCount === 1 ? "" : "s"}
              </>
            ) : (
              "No transactions yet"
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {primary && (
            <span className="text-lg font-semibold tabular-nums">
              {formatMoneyWhole(primary.net, primary.currency)}
            </span>
          )}
          {chevron(open)}
        </div>
      </button>

      {open && (
        <div className="mt-5 flex flex-col gap-5 border-t border-line pt-5">
          {trip.currencies.length === 0 ? (
            <p className="text-sm text-muted">
              Select transactions on the Transactions page and attach them to this trip.
            </p>
          ) : (
            trip.currencies.map((c) => (
              <div key={c.currency}>
                {trip.currencies.length > 1 && (
                  <p className="mb-2 font-mono text-xs uppercase tracking-wider text-muted">
                    {c.currency}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-muted">Spent</p>
                    <p className="font-medium tabular-nums">{formatMoney(c.spent, c.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Reimbursed</p>
                    <p className="font-medium tabular-nums">
                      {c.reimbursed > 0 ? formatMoney(c.reimbursed, c.currency) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Cost you</p>
                    <p className="font-medium tabular-nums">{formatMoney(c.net, c.currency)}</p>
                  </div>
                </div>
              </div>
            ))
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={`/trips/${trip.id}`}
              className="text-sm font-medium underline underline-offset-4 hover:text-accent"
            >
              View transactions &rarr;
            </Link>
            <div className="flex items-center gap-1">
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
            <p role="alert" className="text-sm text-negative">
              {deleteState.error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
