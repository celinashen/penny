"use client";

import { useActionState } from "react";
import { setPayrollFunded, type PayrollState } from "./actions";

const initial: PayrollState = {};

/** "Deposits into this account come from my paycheck": saves as soon as it's toggled. */
export function PayrollToggle({ id, checked }: { id: string; checked: boolean }) {
  const [state, action, pending] = useActionState(setPayrollFunded, initial);

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={id} />
      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted">
        <input
          type="checkbox"
          name="payroll"
          defaultChecked={checked}
          disabled={pending}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="mt-0.5 h-4 w-4 accent-[#0a7d55]"
        />
        <span>
          Deposits come from my paycheck
          <span className="block text-xs">
            Counted as income, and as money you invested.
          </span>
        </span>
      </label>
      {pending && <span className="text-xs text-muted">Saving&hellip;</span>}
      {state.error && (
        <span role="alert" className="text-xs text-negative">
          {state.error}
        </span>
      )}
    </form>
  );
}
