import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function Transactions() {
  return (
    <>
      <PageHeader title="Transactions" />
      <EmptyState
        title="No transactions yet"
        description="Add an account, then import a CSV or connect your bank to see your activity here."
      />
    </>
  );
}
