"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/form-styles";
import {
  DOUBLE_ADD_WARNING,
  clearLinkSession,
  completeLink,
  post,
  saveLinkSession,
} from "@/lib/plaid-browser";

/**
 * Opens Plaid Link. Without `itemId` it connects a new bank; with one it
 * repairs that connection (Plaid "update mode"), which reuses the same Item.
 */
export function ConnectBankButton({
  itemId,
  label,
  variant = "primary",
  confirmNew = false,
  kind = "bank",
}: {
  itemId?: string;
  label: string;
  variant?: "primary" | "secondary";
  /** "investment" connects a brokerage (holdings and contributions) instead of a bank. */
  kind?: "bank" | "investment";
  /** Ask before spending one of the limited real Plaid connections. */
  confirmNew?: boolean;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSuccess = useCallback(
    // Update mode (reconnecting) has no public token: the Item already exists.
    async (publicToken: string | null) => {
      try {
        await completeLink(publicToken, { itemId, kind });
        router.refresh();
      } catch (e) {
        setError(`${e instanceof Error ? e.message : "Something went wrong."} ${DOUBLE_ADD_WARNING}`);
      } finally {
        clearLinkSession();
        setBusy(false);
        setToken(null);
      }
    },
    [itemId, kind, router],
  );

  const { open, ready } = usePlaidLink({
    token,
    onSuccess,
    onExit: () => {
      clearLinkSession();
      setBusy(false);
      setToken(null);
    },
  });

  useEffect(() => {
    if (token && ready) open();
  }, [token, ready, open]);

  async function start() {
    if (
      confirmNew &&
      !itemId &&
      !window.confirm(
        "This uses one of your 10 limited Plaid production connections and cannot be undone by removing it. Only connect a bank you haven’t already connected. Continue?",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await post("/api/plaid/link-token", { itemId, kind });
      // Kept while you're at a bank that uses OAuth, so the return page can
      // finish this same connection when the bank sends you back.
      saveLinkSession({
        token: data.link_token,
        itemId,
        kind,
        returnTo: `${window.location.pathname}${window.location.search}`,
      });
      setToken(data.link_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className={
          variant === "primary" ? primaryButtonClass : secondaryButtonClass
        }
      >
        {busy ? "One moment…" : label}
      </button>
      {error && (
        <p role="alert" className="max-w-md text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
