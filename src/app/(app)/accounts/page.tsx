import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function Accounts() {
  return (
    <>
      <PageHeader title="Accounts" />
      <EmptyState
        title="No accounts yet"
        description="Add the cards and bank accounts you want to track, in US or Canadian dollars."
      />
    </>
  );
}
