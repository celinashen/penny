"use client";

import { useActionState } from "react";
import { reopenAccount, type AccountFormState } from "./actions";

const initial: AccountFormState = {};

export function ReopenButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(reopenAccount, initial);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-raised disabled:opacity-50"
      >
        {pending ? "Reopening…" : "Reopen"}
      </button>
      {state.error && (
        <p role="alert" className="text-xs text-negative">
          {state.error}
        </p>
      )}
    </form>
  );
}
