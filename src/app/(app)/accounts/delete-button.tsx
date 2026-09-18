"use client";

import { useActionState } from "react";
import { deleteAccount, type AccountFormState } from "./actions";

const initial: AccountFormState = {};

export function DeleteButton({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(deleteAccount, initial);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        // Deleting an account also deletes every transaction in it.
        if (
          !window.confirm(
            `Delete “${name}” and all of its transactions? This can’t be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
      className="flex flex-col items-end gap-1"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-raised hover:text-negative disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state.error && (
        <p role="alert" className="text-xs text-negative">
          {state.error}
        </p>
      )}
    </form>
  );
}
