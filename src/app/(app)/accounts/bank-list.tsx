import { timeAgo } from "@/lib/time";
import { ConnectBankButton } from "./connect-bank-button";
import { SyncButton } from "./sync-button";

export type BankItem = {
  id: string;
  institution_name: string | null;
  status: "good" | "needs_reauth" | "error";
  last_synced_at: string | null;
  last_error: string | null;
};

function statusLine(item: BankItem) {
  if (item.status === "needs_reauth") {
    return { text: "Needs you to sign in again", tone: "text-negative" };
  }
  if (item.status === "error") {
    return {
      text: item.last_error ?? "The last sync failed",
      tone: "text-negative",
    };
  }
  return {
    text: `Synced ${timeAgo(item.last_synced_at)}`,
    tone: "text-muted",
  };
}

export function BankList({ items }: { items: BankItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-muted">
        No banks connected yet. Connect one to pull in your transactions
        automatically every day.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {items.map((item) => {
        const { text, tone } = statusLine(item);
        return (
          <li
            key={item.id}
            className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">
                {item.institution_name ?? "Bank"}
              </p>
              <p className={`truncate text-sm ${tone}`}>{text}</p>
            </div>
            {item.status === "needs_reauth" ? (
              <ConnectBankButton
                itemId={item.id}
                label="Reconnect"
                variant="secondary"
              />
            ) : (
              <SyncButton itemId={item.id} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
