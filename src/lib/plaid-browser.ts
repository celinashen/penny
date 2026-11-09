// Browser-side helpers for Plaid Link.
//
// Banks that use OAuth (Chase, Bank of America, and others) send you to their own
// site to sign in and then back to this app. The page that receives you has to
// re-open Plaid Link with the *same* link token, so the token and what it was for
// are kept in browser storage while you're away.

export type LinkKind = "bank" | "investment";

export type LinkSession = {
  token: string;
  /** Set when reopening an existing connection (Plaid "update mode") to repair it or add an account. */
  itemId?: string;
  kind: LinkKind;
  /** Where to send you when it's done. */
  returnTo: string;
  savedAt: number;
};

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const KEY = "penny.plaid.link";
/** Plaid link tokens last four hours; don't trust a saved one for longer than three. */
const MAX_AGE_MS = 3 * 60 * 60 * 1000;

/** The browser's local storage, or null where it's unavailable (private mode, blocked). */
function browserStorage(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function saveLinkSession(
  session: Omit<LinkSession, "savedAt">,
  storage: Store | null = browserStorage(),
  now: number = Date.now(),
) {
  try {
    storage?.setItem(KEY, JSON.stringify({ ...session, savedAt: now }));
  } catch {
    // Storage full or blocked: everything except OAuth banks still works.
  }
}

/** The saved session, or null if there isn't a usable one. */
export function readLinkSession(
  storage: Store | null = browserStorage(),
  now: number = Date.now(),
): LinkSession | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<LinkSession>;
    if (typeof s.token !== "string" || !s.token) return null;
    if (s.kind !== "bank" && s.kind !== "investment") return null;
    if (typeof s.returnTo !== "string" || !s.returnTo.startsWith("/") || s.returnTo.startsWith("//")) {
      return null;
    }
    if (typeof s.savedAt !== "number" || now - s.savedAt > MAX_AGE_MS || s.savedAt > now + 60_000) {
      return null;
    }
    return {
      token: s.token,
      kind: s.kind,
      returnTo: s.returnTo,
      savedAt: s.savedAt,
      ...(typeof s.itemId === "string" ? { itemId: s.itemId } : {}),
    };
  } catch {
    return null;
  }
}

export function clearLinkSession(storage: Store | null = browserStorage()) {
  try {
    storage?.removeItem(KEY);
  } catch {
    // Nothing to clean up.
  }
}

export async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

/**
 * What to do when Plaid Link succeeds. A new connection is saved and synced;
 * update mode (no public token — repairing a login or adding an account)
 * just syncs, which is enough to pick up any newly available account.
 */
export async function completeLink(
  publicToken: string | null,
  session: Pick<LinkSession, "itemId" | "kind">,
) {
  if (session.itemId) {
    await post("/api/plaid/sync", { itemId: session.itemId });
    return;
  }
  if (!publicToken) throw new Error("Plaid didn’t return a token.");
  await post("/api/plaid/exchange", { public_token: publicToken, kind: session.kind });
}

export const DOUBLE_ADD_WARNING =
  "Refresh the page before trying again, so the same bank isn’t added twice.";

type LinkExitError = { error_type: string; error_code: string; error_message: string; display_message: string | null };
type LinkExitMetadata = { link_session_id: string; request_id: string; status: string | null; institution: { name: string } | null };

/**
 * When Plaid Link closes because of an error, reports it to the server log and
 * returns a message to show, with the IDs Plaid support needs to trace it.
 * Returns null when you simply closed Link yourself.
 */
export function reportLinkExit(
  err: LinkExitError | null,
  metadata: LinkExitMetadata,
  context: Pick<LinkSession, "itemId" | "kind">,
): string | null {
  if (!err) return null;
  const details = {
    ...context,
    error_type: err.error_type,
    error_code: err.error_code,
    error_message: err.error_message,
    status: metadata.status,
    institution: metadata.institution?.name ?? null,
    link_session_id: metadata.link_session_id,
    request_id: metadata.request_id,
  };
  // Best effort: the message below still shows if this doesn't get through.
  post("/api/plaid/link-exit", details).catch(() => {});
  const reason = err.display_message || err.error_message || "Plaid ran into a problem.";
  return `${reason} (${err.error_code}). Plaid session ID: ${metadata.link_session_id}`;
}
