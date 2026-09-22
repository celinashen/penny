"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  compactInputClass,
  compactPrimaryClass,
  compactSecondaryClass,
} from "@/components/form-styles";
import { merchantKey } from "@/lib/categorize/merchant-key";
import { formatDay, formatMoney, type Category, type Tx } from "@/lib/transactions";
import type { MealCandidate } from "./page";
import { CategoryOptions } from "./category-select";
import {
  deleteTransaction,
  linkReimbursement,
  unlinkReimbursement,
  updateTransaction,
  type TxFormState,
} from "./actions";
import { detachFromTrip, type TripFormState } from "../trips/trip-actions";

const initial: TxFormState = {};
const tripInitial: TripFormState = {};

export function TransactionRow({
  tx,
  categories,
  mealCandidates,
  showCurrency,
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  tx: Tx;
  categories: Category[];
  mealCandidates: MealCandidate[];
  showCurrency: boolean;
  /** Whether a trip exists to select this row for, so bulk-attach is possible. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateTransaction, initial);
  const [delState, delAction, deleting] = useActionState(deleteTransaction, initial);
  const [linkState, linkAction, linking] = useActionState(linkReimbursement, initial);
  const [unlinkState, unlinkAction, unlinking] = useActionState(unlinkReimbursement, initial);
  const [detachState, detachAction, detaching] = useActionState(detachFromTrip, tripInitial);

  // Close the editor once a save goes through.
  useEffect(() => {
    if (!state.ok) return;
    setOpen(false);
    router.refresh();
  }, [router, state]);

  useEffect(() => {
    if (linkState.ok || unlinkState.ok || detachState.ok) router.refresh();
  }, [linkState, router, unlinkState, detachState]);

  const title = tx.merchant || tx.description;
  const inflow = tx.amount > 0;

  return (
    <li className="flex items-stretch">
      {selectable && (
        <label className="flex shrink-0 items-center pl-4 sm:pl-5">
          <span className="sr-only">Select {title}</span>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="h-4 w-4 accent-[#0a7d55]"
          />
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-raised/50 sm:px-5"
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <span className="truncate">{title}</span>
            {tx.pending && (
              <span className="shrink-0 rounded-full bg-raised px-2 py-0.5 text-xs font-medium text-muted">
                Pending
              </span>
            )}
          </p>
          <p className="truncate text-sm text-muted">
            {tx.account.name}
            {" · "}
            {tx.category ? (
              tx.category.name
            ) : (
              <span className="font-medium text-warn">Uncategorized</span>
            )}
            {tx.trip ? ` · ${tx.trip.name}` : ""}
            {tx.notes ? ` · ${tx.notes}` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 tabular-nums ${inflow ? "font-medium text-positive" : ""}`}
        >
          {formatMoney(tx.amount, tx.account.currency, true)}
          {showCurrency && (
            <span className="ml-1.5 text-xs font-normal text-muted">
              {tx.account.currency}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-line bg-background/60 px-4 py-4 sm:px-5">
          <form action={action} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={tx.id} />

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Category
              <select
                name="category_id"
                defaultValue={tx.category_id ?? ""}
                className={compactInputClass}
              >
                <CategoryOptions categories={categories} />
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Note
              <input
                name="notes"
                defaultValue={tx.notes ?? ""}
                maxLength={500}
                placeholder="Add a note"
                className={compactInputClass}
              />
            </label>

            <label className="flex items-start gap-2.5 text-sm text-muted sm:col-span-2">
              <input
                type="checkbox"
                name="apply"
                defaultChecked
                className="mt-0.5 h-4 w-4 accent-[#0a7d55]"
              />
              <span>
                Use this category for other transactions from{" "}
                <span className="font-medium text-foreground">
                  &ldquo;{merchantKey(tx.description, tx.merchant)}&rdquo;
                </span>
              </span>
            </label>

            {state.error && (
              <p role="alert" className="text-sm text-negative sm:col-span-2">
                {state.error}
              </p>
            )}

            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" disabled={pending} className={compactPrimaryClass}>
                {pending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={compactSecondaryClass}
              >
                Cancel
              </button>
            </div>
          </form>

          {tx.trip && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4 text-sm">
              <span className="text-muted">
                Part of the{" "}
                <Link href={`/trips/${tx.trip.id}`} className="font-medium text-foreground hover:underline">
                  {tx.trip.name}
                </Link>{" "}
                trip, counted under Travel.
              </span>
              <form action={detachAction}>
                <input type="hidden" name="id" value={tx.id} />
                <button
                  type="submit"
                  disabled={detaching}
                  className="font-medium text-muted hover:text-negative"
                >
                  {detaching ? "Removing…" : "Remove from trip"}
                </button>
              </form>
              {detachState.error && (
                <span role="alert" className="text-negative">
                  {detachState.error}
                </span>
              )}
            </div>
          )}

          {tx.amount > 0 && (
            <div className="mt-4 border-t border-line pt-4">
              {tx.reimbursement ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted">
                    Applied to {tx.reimbursement.expense.merchant || tx.reimbursement.expense.description}
                    {" "}({formatMoney(tx.reimbursement.amount, tx.account.currency)})
                  </span>
                  <form action={unlinkAction}>
                    <input type="hidden" name="id" value={tx.reimbursement.id} />
                    <button type="submit" disabled={unlinking} className="font-medium text-muted hover:text-negative">
                      {unlinking ? "Removing…" : "Remove"}
                    </button>
                  </form>
                  {unlinkState.error && <span role="alert" className="text-negative">{unlinkState.error}</span>}
                </div>
              ) : (
                <form action={linkAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="reimbursement_id" value={tx.id} />
                  <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-medium">
                    Apply to a recent meal
                    <select name="expense_id" defaultValue="" className={compactInputClass}>
                      <option value="">Choose an expense</option>
                      {mealCandidates
                        .filter(
                          (meal) =>
                            meal.id !== tx.id &&
                            meal.amount < 0 &&
                            meal.account.currency === tx.account.currency,
                        )
                        .map((meal) => (
                          <option key={meal.id} value={meal.id}>
                            {formatDay(meal.posted_date)} · {meal.merchant || meal.description} · {formatMoney(Math.abs(meal.amount), meal.account.currency)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button type="submit" disabled={linking} className={compactSecondaryClass}>
                    {linking ? "Applying…" : "Apply"}
                  </button>
                  {linkState.error && <span role="alert" className="w-full text-sm text-negative">{linkState.error}</span>}
                </form>
              )}
            </div>
          )}

          {tx.source !== "plaid" && (
            <form
              action={delAction}
              onSubmit={(e) => {
                if (!window.confirm("Delete this transaction? This can’t be undone.")) {
                  e.preventDefault();
                }
              }}
              className="mt-3 flex items-center gap-3"
            >
              <input type="hidden" name="id" value={tx.id} />
              <button
                type="submit"
                disabled={deleting}
                className="text-sm font-medium text-muted transition-colors hover:text-negative disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete transaction"}
              </button>
              {delState.error && (
                <span role="alert" className="text-sm text-negative">
                  {delState.error}
                </span>
              )}
            </form>
          )}
        </div>
      )}
    </li>
  );
}
