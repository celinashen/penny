import { accountTypeLabel, type Account } from "@/lib/accounts";
import { ReopenButton } from "./reopen-button";

export function ClosedAccounts({ accounts }: { accounts: Account[] }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-dashed border-line">
      {accounts.map((a) => (
        <li
          key={a.id}
          className="flex items-center justify-between gap-4 px-4 py-3.5 text-muted sm:px-5"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{a.name}</p>
            <p className="truncate text-sm">
              {a.institution ? `${a.institution} · ` : ""}
              {accountTypeLabel(a.type)}
            </p>
          </div>
          <ReopenButton id={a.id} />
        </li>
      ))}
    </ul>
  );
}
