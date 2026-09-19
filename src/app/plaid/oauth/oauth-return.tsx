"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import {
  DOUBLE_ADD_WARNING,
  clearLinkSession,
  completeLink,
  readLinkSession,
  type LinkSession,
} from "@/lib/plaid-browser";

type State =
  | { phase: "loading" }
  | { phase: "ready"; session: LinkSession; receivedRedirectUri: string }
  | { phase: "saving" }
  | { phase: "error"; message: string };

/**
 * Where a bank sends you back to after you sign in on its own site (OAuth).
 * Re-opens Plaid Link with the same link token and the address we were sent to,
 * which lets Plaid finish the connection.
 */
export function OAuthReturn() {
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: "loading" });

  // Read what we saved before leaving for the bank.
  useEffect(() => {
    const session = readLinkSession();
    if (!session) {
      setState({
        phase: "error",
        message:
          "We couldn’t find the connection you were making, or it took too long. Nothing was added. Go back and try again.",
      });
      return;
    }
    setState({ phase: "ready", session, receivedRedirectUri: window.location.href });
  }, []);

  const session = state.phase === "ready" ? state.session : null;

  const onSuccess = useCallback(
    async (publicToken: string | null) => {
      if (!session) return;
      setState({ phase: "saving" });
      try {
        await completeLink(publicToken, session);
        clearLinkSession();
        router.replace(session.returnTo);
      } catch (e) {
        clearLinkSession();
        setState({
          phase: "error",
          message: `${e instanceof Error ? e.message : "Something went wrong."} ${DOUBLE_ADD_WARNING}`,
        });
      }
    },
    [session, router],
  );

  const { open, ready } = usePlaidLink({
    token: session?.token ?? null,
    receivedRedirectUri: state.phase === "ready" ? state.receivedRedirectUri : undefined,
    onSuccess,
    onExit: () => {
      clearLinkSession();
      router.replace(session?.returnTo ?? "/accounts");
    },
  });

  useEffect(() => {
    if (session && ready) open();
  }, [session, ready, open]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      {state.phase === "error" ? (
        <>
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">Couldn&rsquo;t finish connecting</h1>
          <p role="alert" className="text-muted">
            {state.message}
          </p>
          <Link
            href="/accounts"
            className="mt-2 rounded-full bg-foreground px-6 py-3 font-medium text-surface transition-opacity hover:opacity-85"
          >
            Back to accounts
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">
            {state.phase === "saving" ? "Saving your connection…" : "Finishing your connection…"}
          </h1>
          <p className="text-muted">This takes a few seconds. Please don&rsquo;t close this page.</p>
        </>
      )}
    </main>
  );
}
