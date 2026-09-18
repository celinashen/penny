"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Result = {
  added: number;
  modified: number;
  removed: number;
  status: string;
  message?: string;
};

export function SyncButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/plaid/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed.");
      const r: Result | undefined = data.results?.[0];
      setNote(
        r?.message ??
          `${r?.added ?? 0} new, ${r?.modified ?? 0} updated`,
      );
      router.refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={sync}
        disabled={busy}
        className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-raised disabled:opacity-50"
      >
        {busy ? "Syncing…" : "Sync now"}
      </button>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
}
