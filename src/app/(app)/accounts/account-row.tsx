"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  compactInputClass,
  compactPrimaryClass,
  compactSecondaryClass,
} from "@/components/form-styles";
import { accountTypeLabel, type Account } from "@/lib/accounts";
import { closeAccount, renameAccount, type AccountFormState } from "./actions";
import { DeleteButton } from "./delete-button";

const initial: AccountFormState = {};

export function AccountRow({ account }: { account: Account }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [renameState, renameAction, renaming] = useActionState(renameAccount, initial);
  const [closeState, closeAction, closing] = useActionState(closeAccount, initial);

  useEffect(() => {
    if (renameState.ok) setEditing(false);
  }, [renameState]);

  useEffect(() => {
    if (closeState.ok) router.refresh();
  }, [closeState, router]);

  if (editing) {
    return (
      <li className="px-4 py-3.5 sm:px-5">
        <form action={renameAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={account.id} />
          <input
            name="name"
            defaultValue={account.name}
            maxLength={80}
            autoFocus
            className={`${compactInputClass} max-w-xs flex-1`}
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
    <li className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
      <div className="min-w-0">
        <p className="truncate font-medium">{account.name}</p>
        <p className="truncate text-sm text-muted">
          {accountTypeLabel(account.type)}
          {account.source === "plaid" ? " · Synced" : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-raised"
        >
          Rename
        </button>
        <form
          action={closeAction}
          onSubmit={(e) => {
            const plaidNote = account.source === "plaid"
              ? " Reopening it later is free and won’t use another Plaid connection."
              : "";
            if (
              !window.confirm(
                `Close “${account.name}”? Its past transactions stay, but new ones won’t be added and it won’t show up as a filter or picker elsewhere.${plaidNote}`,
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={account.id} />
          <button
            type="submit"
            disabled={closing}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-raised hover:text-negative disabled:opacity-50"
          >
            {closing ? "Closing…" : "Close"}
          </button>
        </form>
        {account.source !== "plaid" && <DeleteButton id={account.id} name={account.name} />}
      </div>
      {closeState.error && (
        <p role="alert" className="text-sm text-negative">
          {closeState.error}
        </p>
      )}
    </li>
  );
}
