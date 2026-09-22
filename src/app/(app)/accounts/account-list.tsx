import { CURRENCIES, type Account } from "@/lib/accounts";
import { AccountRow } from "./account-row";

/** Accounts grouped by currency (USD and CAD are never mixed), then by the bank they're connected through. */
export function AccountList({ accounts }: { accounts: Account[] }) {
  return (
    <div className="flex flex-col gap-8">
      {CURRENCIES.map(({ value, label }) => {
        const group = accounts.filter((a) => a.currency === value);
        if (group.length === 0) return null;

        const byInstitution = new Map<string, Account[]>();
        for (const a of group) {
          const key = a.institution ?? "";
          byInstitution.set(key, [...(byInstitution.get(key) ?? []), a]);
        }
        // Named institutions first (alphabetical); hand-added accounts with none go last.
        const institutions = [...byInstitution.entries()].sort(([a], [b]) => {
          if (!a) return 1;
          if (!b) return -1;
          return a.localeCompare(b);
        });

        return (
          <section key={value}>
            <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-muted">
              {value} &middot; {label} &middot; {group.length}{" "}
              {group.length === 1 ? "account" : "accounts"}
            </h2>
            <div className="flex flex-col gap-4">
              {institutions.map(([institution, items]) => (
                <div key={institution || "none"}>
                  {institution && (
                    <h3 className="mb-1.5 px-1 text-sm font-medium text-muted">
                      {institution}
                    </h3>
                  )}
                  <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                    {items.map((a) => (
                      <AccountRow key={a.id} account={a} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
