"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/form-styles";

const json = { "Content-Type": "application/json" };

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: json,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

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
        if (itemId) {
          await post("/api/plaid/sync", { itemId });
        } else {
          if (!publicToken) throw new Error("Plaid didn’t return a token.");
          await post("/api/plaid/exchange", { public_token: publicToken, kind });
        }
        router.refresh();
      } catch (e) {
        setError(
          `${e instanceof Error ? e.message : "Something went wrong."} ` +
            "Refresh the page before trying again, so the same bank isn’t added twice.",
        );
      } finally {
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
        "This uses one of your limited Plaid connections. Only connect a bank you haven’t already connected. Continue?",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await post("/api/plaid/link-token", { itemId, kind });
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
