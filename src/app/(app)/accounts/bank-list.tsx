import { timeAgo } from "@/lib/time";
import { ConnectBankButton } from "./connect-bank-button";
import { SyncButton } from "./sync-button";

export type BankItem = {
  id: string;
  institution_name: string | null;
  status: "good" | "needs_reauth" | "error";
  last_synced_at: string | null;
  last_error: string | null;
  /** What this connection provides: "transactions", "investments", or both. */
  products: string[];
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
  // A note here on a healthy connection means a big first load is still finishing.
  return {
    text: `Synced ${timeAgo(item.last_synced_at)}${item.last_error ? ` · ${item.last_error}` : ""}`,
    tone: "text-muted",
  };
}

export function BankList({
  items,
  investmentItemIds,
}: {
  items: BankItem[];
  /** Connections that have at least one brokerage-type account under them. */
  investmentItemIds: Set<string>;
}) {
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
              <div className="flex flex-wrap items-center gap-2">
                <SyncButton itemId={item.id} />
                <ConnectBankButton
                  itemId={item.id}
                  label="Add account"
                  variant="secondary"
                />
                {investmentItemIds.has(item.id) && !item.products.includes("investments") && (
                  <ConnectBankButton
                    itemId={item.id}
                    kind="investment"
                    addInvestments
                    label="Enable investment tracking"
                    variant="secondary"
                  />
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
