import { PageHeader } from "@/components/page-header";
import type { Account } from "@/lib/accounts";
import { createClient } from "@/lib/supabase/server";
import { AccountForm } from "./account-form";
import { AccountList } from "./account-list";
import { BankList, type BankItem } from "./bank-list";
import { ClosedAccounts } from "./closed-accounts";
import { ConnectBankButton } from "./connect-bank-button";

export default async function Accounts() {
  const supabase = await createClient();
  // Row-level security limits both queries to the signed-in user. The token
  // column on plaid_items is deliberately not selectable from here.
  const [accountsRes, itemsRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, institution, type, currency, source, closed")
      .order("name"),
    supabase
      .from("plaid_items")
      .select("id, institution_name, status, last_synced_at, last_error")
      .order("created_at"),
  ]);

  const allAccounts = (accountsRes.data ?? []) as Account[];
  const accounts = allAccounts.filter((a) => !a.closed);
  const closedAccounts = allAccounts.filter((a) => a.closed);
  const items = (itemsRes.data ?? []) as BankItem[];
  const failed = accountsRes.error || itemsRes.error;

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Connect your banks to sync automatically, or add accounts by hand. US and Canadian dollars are kept separate."
      />

      {failed ? (
        <p role="alert" className="text-negative">
          Couldn&rsquo;t load your accounts. Refresh to try again.
        </p>
      ) : (
        <div className="flex flex-col gap-12">
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-[-0.02em]">
                Connected banks
              </h2>
              <ConnectBankButton
                label="+ Connect a bank"
                confirmNew={process.env.PLAID_ENV === "production"}
              />
            </div>
            <BankList items={items} />
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold tracking-[-0.02em]">
              All accounts
            </h2>
            <AccountForm first={false} />
            <AccountList accounts={accounts} />
          </section>

          {closedAccounts.length > 0 && (
            <section>
              <h2 className="mb-1 text-xl font-semibold tracking-[-0.02em]">
                Closed accounts
              </h2>
              <p className="mb-4 text-sm text-muted">
                Past transactions still count toward your history, but new ones won&rsquo;t be
                added and these won&rsquo;t show up as a filter or picker elsewhere. Reopening
                one is free and, for a synced bank, doesn&rsquo;t use another Plaid connection.
              </p>
              <ClosedAccounts accounts={closedAccounts} />
            </section>
          )}
        </div>
      )}
    </>
  );
}
