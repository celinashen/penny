"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  compactInputClass,
  compactPrimaryClass,
  compactSecondaryClass,
  secondaryButtonClass,
} from "@/components/form-styles";
import { createTrip, type TripFormState } from "./trip-actions";

const initial: TripFormState = {};

export function AddTrip() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createTrip, initial);

  useEffect(() => {
    if (!state.ok) return;
    setOpen(false);
    router.refresh();
  }, [router, state]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={secondaryButtonClass}>
        + Add a trip
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-start gap-2">
      <input
        name="name"
        placeholder="Trip name, e.g. Italy"
        maxLength={80}
        autoFocus
        className={`${compactInputClass} w-48`}
      />
      <button type="submit" disabled={pending} className={compactPrimaryClass}>
        {pending ? "Saving…" : "Create"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className={compactSecondaryClass}>
        Cancel
      </button>
      {state.error && (
        <p role="alert" className="w-full text-sm text-negative">
          {state.error}
        </p>
      )}
    </form>
  );
}
