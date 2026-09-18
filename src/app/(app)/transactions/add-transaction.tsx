"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  compactInputClass,
  compactPrimaryClass,
  compactSecondaryClass,
  primaryButtonClass,
} from "@/components/form-styles";
import type { Category } from "@/lib/transactions";
import { createTransaction, type TxFormState } from "./actions";
import { CategoryOptions } from "./category-select";

const initial: TxFormState = {};

type AccountOption = { id: string; name: string; currency: string };

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AddTransaction({
  accounts,
  categories,
}: {
  accounts: AccountOption[];
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createTransaction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={primaryButtonClass}>
        + Add transaction
      </button>
    );
  }

  return (
    <section className="mb-6 w-full rounded-3xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(14,21,18,0.04),0_8px_24px_-12px_rgba(14,21,18,0.08)] sm:p-7">
      <h2 className="mb-5 text-xl font-semibold tracking-[-0.02em]">New transaction</h2>
      <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Account
          <select name="account_id" required className={compactInputClass}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Date
          <input name="date" type="date" required defaultValue={today()} className={compactInputClass} />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
          Description
          <input name="description" required maxLength={200} placeholder="Where was it?" className={compactInputClass} />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Amount
          <input
            name="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
            className={compactInputClass}
          />
        </label>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Type</legend>
          <div className="grid h-11 grid-cols-2 gap-1 rounded-xl border border-line bg-raised p-1">
            {[
              { value: "spending", label: "Spending" },
              { value: "income", label: "Income" },
            ].map((k, i) => (
              <label key={k.value} className="relative">
                <input type="radio" name="kind" value={k.value} defaultChecked={i === 0} className="peer sr-only" />
                <span className="grid h-full cursor-pointer place-items-center rounded-lg text-sm font-medium text-muted transition-colors peer-checked:bg-surface peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                  {k.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Category
          <select name="category_id" className={compactInputClass}>
            <CategoryOptions categories={categories} blankLabel="Choose for me" />
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Note <span className="sr-only">(optional)</span>
          <input name="notes" maxLength={500} placeholder="Optional" className={compactInputClass} />
        </label>

        {state.error && (
          <p role="alert" className="text-sm text-negative sm:col-span-2">
            {state.error}
          </p>
        )}

        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button type="submit" disabled={pending} className={compactPrimaryClass}>
            {pending ? "Saving…" : "Save transaction"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className={compactSecondaryClass}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
