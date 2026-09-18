"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/form-styles";
import { ACCOUNT_TYPES, CURRENCIES } from "@/lib/accounts";
import { createAccount, type AccountFormState } from "./actions";

const initial: AccountFormState = {};

export function AccountForm({ first }: { first: boolean }) {
  const [open, setOpen] = useState(first);
  const [state, action, pending] = useActionState(createAccount, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // After a successful save, clear the form and tuck it away.
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <div className="mb-8">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={primaryButtonClass}
        >
          + Add account
        </button>
      </div>
    );
  }

  return (
    <section className="mb-8 rounded-3xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(14,21,18,0.04),0_8px_24px_-12px_rgba(14,21,18,0.08)] sm:p-7">
      <h2 className="mb-5 text-xl font-semibold tracking-[-0.02em]">
        {first ? "Add your first account" : "New account"}
      </h2>

      <form ref={formRef} action={action} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Name
            <input
              name="name"
              required
              maxLength={80}
              placeholder="Chase Sapphire Preferred"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Institution <span className="sr-only">(optional)</span>
            <input
              name="institution"
              maxLength={80}
              placeholder="Chase (optional)"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Type
            <select name="type" defaultValue="credit" className={inputClass}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Currency</legend>
            <div className="grid h-13 grid-cols-2 gap-1 rounded-xl border border-line bg-raised p-1">
              {CURRENCIES.map((c, i) => (
                <label key={c.value} className="relative">
                  <input
                    type="radio"
                    name="currency"
                    value={c.value}
                    defaultChecked={i === 0}
                    className="peer sr-only"
                  />
                  <span
                    title={c.label}
                    className="grid h-full cursor-pointer place-items-center rounded-lg text-sm font-medium text-muted transition-colors peer-checked:bg-surface peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-accent"
                  >
                    {c.value}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {state.error && (
          <p role="alert" className="text-sm text-negative">
            {state.error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? "Saving…" : "Save account"}
          </button>
          {!first && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
