import { PageHeader } from "@/components/page-header";
import type { Account } from "@/lib/accounts";
import { createClient } from "@/lib/supabase/server";
import { AccountForm } from "./account-form";
import { AccountList } from "./account-list";

export default async function Accounts() {
  const supabase = await createClient();
  // Row-level security limits this to the signed-in user's accounts.
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, institution, type, currency, source")
    .order("name");

  const accounts = (data ?? []) as Account[];

  return (
    <>
      <PageHeader
        title="Accounts"
        description="The cards and accounts you track. US and Canadian dollars are kept separate."
      />

      {error ? (
        <p role="alert" className="text-negative">
          Couldn&rsquo;t load your accounts. Refresh to try again.
        </p>
      ) : (
        <>
          <AccountForm first={accounts.length === 0} />
          <AccountList accounts={accounts} />
        </>
      )}
    </>
  );
}
