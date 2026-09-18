import { PageHeader } from "@/components/page-header";
import type { Account } from "@/lib/accounts";
import { createClient } from "@/lib/supabase/server";
import { AccountForm } from "./account-form";
import { AccountList } from "./account-list";
import { BankList, type BankItem } from "./bank-list";
import { ConnectBankButton } from "./connect-bank-button";

export default async function Accounts() {
  const supabase = await createClient();
  // Row-level security limits both queries to the signed-in user. The token
  // column on plaid_items is deliberately not selectable from here.
  const [accountsRes, itemsRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, institution, type, currency, source")
      .order("name"),
    supabase
      .from("plaid_items")
      .select("id, institution_name, status, last_synced_at, last_error")
      .order("created_at"),
  ]);

  const accounts = (accountsRes.data ?? []) as Account[];
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
        </div>
      )}
    </>
  );
}
