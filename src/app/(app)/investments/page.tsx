import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function Investments() {
  return (
    <>
      <PageHeader title="Investments" />
      <EmptyState
        title="No holdings yet"
        description="Add your investment accounts to see what you've invested, your gain or loss, and what it's worth today."
      />
    </>
  );
}
