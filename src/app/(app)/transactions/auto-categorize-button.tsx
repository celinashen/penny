"use client";

import { useActionState } from "react";
import { secondaryButtonClass } from "@/components/form-styles";
import { categorizeUncategorized, type TxFormState } from "./actions";

const initial: TxFormState = {};

/** Fills in categories for transactions that don't have one yet. */
export function AutoCategorizeButton({ count }: { count: number }) {
  const [state, action, pending] = useActionState(
    () => categorizeUncategorized(),
    initial,
  );

  return (
    <form action={action} className="flex flex-col items-start gap-1.5">
      <button type="submit" disabled={pending} className={secondaryButtonClass}>
        {pending
          ? "Categorizing…"
          : `Auto-categorize ${count.toLocaleString("en-US")}`}
      </button>
      {state.message && <p className="text-sm text-muted">{state.message}</p>}
      {state.error && (
        <p role="alert" className="text-sm text-negative">
          {state.error}
        </p>
      )}
    </form>
  );
}
