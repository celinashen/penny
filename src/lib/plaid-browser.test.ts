import { afterEach, describe, expect, it, vi } from "vitest";
import { clearLinkSession, completeLink, readLinkSession, reportLinkExit, saveLinkSession } from "./plaid-browser";

/** A stand-in for localStorage. */
function fakeStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    raw: data,
  };
}

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;
const session = { token: "link-production-abc", kind: "bank" as const, returnTo: "/accounts" };

describe("link session storage", () => {
  it("remembers a link across the trip to the bank and back", () => {
    const store = fakeStore();
    saveLinkSession(session, store, NOW);
    expect(readLinkSession(store, NOW + 5 * 60_000)).toEqual({ ...session, savedAt: NOW });
  });

  it("remembers a repair connection and where to go afterwards", () => {
    const store = fakeStore();
    saveLinkSession({ ...session, itemId: "item-1", kind: "investment", returnTo: "/investments?cur=USD" }, store, NOW);
    expect(readLinkSession(store, NOW)).toMatchObject({ itemId: "item-1", kind: "investment", returnTo: "/investments?cur=USD" });
  });

  it("forgets a session once it is too old to use", () => {
    const store = fakeStore();
    saveLinkSession(session, store, NOW);
    expect(readLinkSession(store, NOW + 2 * HOUR)).not.toBeNull();
    expect(readLinkSession(store, NOW + 4 * HOUR)).toBeNull();
  });

  it("can be cleared", () => {
    const store = fakeStore();
    saveLinkSession(session, store, NOW);
    clearLinkSession(store);
    expect(readLinkSession(store, NOW)).toBeNull();
  });

  it("returns nothing when nothing was saved", () => {
    expect(readLinkSession(fakeStore(), NOW)).toBeNull();
  });

  it.each([
    ["garbage", "not json"],
    ["a missing token", JSON.stringify({ kind: "bank", returnTo: "/", savedAt: NOW })],
    ["an unknown kind", JSON.stringify({ token: "t", kind: "crypto", returnTo: "/", savedAt: NOW })],
    ["a missing time", JSON.stringify({ token: "t", kind: "bank", returnTo: "/" })],
  ])("ignores %s", (_label, raw) => {
    expect(readLinkSession(fakeStore({ "penny.plaid.link": raw }), NOW)).toBeNull();
  });

  it("refuses a return address that leaves the site", () => {
    for (const returnTo of ["https://evil.example/steal", "//evil.example", "javascript:alert(1)"]) {
      const store = fakeStore({ "penny.plaid.link": JSON.stringify({ ...session, returnTo, savedAt: NOW }) });
      expect(readLinkSession(store, NOW)).toBeNull();
    }
  });

  it("refuses a time stamped in the future", () => {
    const store = fakeStore();
    saveLinkSession(session, store, NOW + 10 * HOUR);
    expect(readLinkSession(store, NOW)).toBeNull();
  });

  it("does not crash where storage is unavailable", () => {
    expect(() => saveLinkSession(session, null, NOW)).not.toThrow();
    expect(readLinkSession(null, NOW)).toBeNull();
    expect(() => clearLinkSession(null)).not.toThrow();
  });

  it("does not crash when storage throws", () => {
    const broken = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("full"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(() => saveLinkSession(session, broken, NOW)).not.toThrow();
    expect(readLinkSession(broken, NOW)).toBeNull();
    expect(() => clearLinkSession(broken)).not.toThrow();
  });
});

describe("completeLink", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch() {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return { ok: true, json: async () => ({}) } as Response;
      }),
    );
    return calls;
  }

  it("adding an account to an existing connection only syncs -- it never exchanges a public token, so no new Plaid Item (and no extra credit) is created", async () => {
    const calls = stubFetch();
    await completeLink(null, { itemId: "item-1", kind: "bank" });
    expect(calls).toEqual(["/api/plaid/sync"]);
  });

  it("a brand-new connection exchanges its public token to create the Item", async () => {
    const calls = stubFetch();
    await completeLink("public-token-abc", { kind: "bank" });
    expect(calls).toEqual(["/api/plaid/exchange"]);
  });

  it("refuses to proceed as a new connection without a public token", async () => {
    stubFetch();
    await expect(completeLink(null, { kind: "bank" })).rejects.toThrow();
  });
});

describe("reportLinkExit", () => {
  afterEach(() => vi.unstubAllGlobals());
  const metadata = { link_session_id: "sess-1", request_id: "req-1", status: null, institution: { name: "Bank of America" } };

  it("stays quiet when you close Link yourself", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(reportLinkExit(null, metadata, { kind: "bank" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs the error and returns a message with the code and session ID", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    const message = reportLinkExit(
      { error_type: "API_ERROR", error_code: "INTERNAL_SERVER_ERROR", error_message: "an unexpected error occurred", display_message: null },
      metadata,
      { itemId: "item-1", kind: "bank" },
    );
    expect(message).toBe("an unexpected error occurred (INTERNAL_SERVER_ERROR). Plaid session ID: sess-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/plaid/link-exit");
    expect(JSON.parse(init.body)).toMatchObject({ itemId: "item-1", error_code: "INTERNAL_SERVER_ERROR", request_id: "req-1" });
  });
});
