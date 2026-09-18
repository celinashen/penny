import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import type { Currency } from "@/lib/accounts";
import { createClient } from "@/lib/supabase/server";
import { ImportWizard } from "./import-wizard";

// A large import runs as a server action from this page, so allow the longest request time.
export const maxDuration = 60;

export default async function ImportTransactions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, currency")
    .order("name");
  const accounts = (data ?? []) as { id: string; name: string; currency: Currency }[];

  return (
    <>
      <Link
        href="/transactions"
        className="mb-4 inline-block text-sm text-muted transition-colors hover:text-foreground"
      >
        &larr; Transactions
      </Link>
      <PageHeader
        title="Import CSV"
        description="Upload a transaction export from your bank. Nothing is saved until you press Import, and importing the same file twice is safe."
      />

      {error ? (
        <p role="alert" className="text-negative">
          Couldn&rsquo;t load your accounts. Refresh to try again.
        </p>
      ) : accounts.length === 0 ? (
        <EmptyState
          title="Add an account first"
          description="Imported transactions are filed under an account."
        >
          <Link
            href="/accounts"
            className="mt-4 rounded-full bg-foreground px-6 py-3 font-medium text-surface transition-opacity hover:opacity-85"
          >
            Go to accounts
          </Link>
        </EmptyState>
      ) : (
        <ImportWizard accounts={accounts} />
      )}
    </>
  );
}
