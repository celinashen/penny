import {
  CURRENCIES,
  accountTypeLabel,
  type Account,
} from "@/lib/accounts";
import { DeleteButton } from "./delete-button";

/** Accounts grouped by currency, so USD and CAD are never mixed. */
export function AccountList({ accounts }: { accounts: Account[] }) {
  return (
    <div className="flex flex-col gap-8">
      {CURRENCIES.map(({ value, label }) => {
        const group = accounts.filter((a) => a.currency === value);
        if (group.length === 0) return null;

        return (
          <section key={value}>
            <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-muted">
              {value} &middot; {label} &middot; {group.length}{" "}
              {group.length === 1 ? "account" : "accounts"}
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {group.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.name}</p>
                    <p className="truncate text-sm text-muted">
                      {a.institution ? `${a.institution} · ` : ""}
                      {accountTypeLabel(a.type)}
                      {a.source === "plaid" ? " · Synced" : ""}
                    </p>
                  </div>
                  {/* Synced accounts come back on the next sync if deleted. */}
                  {a.source !== "plaid" && (
                    <DeleteButton id={a.id} name={a.name} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
