"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  compactInputClass,
  compactPrimaryClass,
  compactSecondaryClass,
} from "@/components/form-styles";
import { deleteTrip, renameTrip, type TripFormState } from "../trip-actions";

const initial: TripFormState = {};

export function TripHeader({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [renameState, renameAction, renaming] = useActionState(renameTrip, initial);
  const [deleteState, deleteAction, deleting] = useActionState(deleteTrip, initial);

  useEffect(() => {
    if (!renameState.ok) return;
    setEditing(false);
    router.refresh();
  }, [renameState, router]);

  // The trip is gone once this succeeds, so leave its page instead of refreshing it.
  useEffect(() => {
    if (deleteState.ok) router.push("/trips");
  }, [deleteState, router]);

  if (editing) {
    return (
      <form action={renameAction} className="mb-6 flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <input
          name="name"
          defaultValue={name}
          maxLength={80}
          autoFocus
          className={`${compactInputClass} max-w-xs flex-1`}
        />
        <button type="submit" disabled={renaming} className={compactPrimaryClass}>
          {renaming ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className={compactSecondaryClass}>
          Cancel
        </button>
        {renameState.error && (
          <p role="alert" className="w-full text-sm text-negative">
            {renameState.error}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setEditing(true)} className={compactSecondaryClass}>
        Rename
      </button>
      <form
        action={deleteAction}
        onSubmit={(e) => {
          if (
            !window.confirm(
              `Delete the "${name}" trip? Its transactions stay -- they'll just go back to the category they had before the trip.`,
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          disabled={deleting}
          className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-raised hover:text-negative disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete trip"}
        </button>
      </form>
      {deleteState.error && (
        <p role="alert" className="w-full text-sm text-negative">
          {deleteState.error}
        </p>
      )}
    </div>
  );
}
