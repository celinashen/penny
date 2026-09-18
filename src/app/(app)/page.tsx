import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function Overview() {
  const month = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <PageHeader eyebrow={month} title="Overview" />
      <EmptyState
        title="Nothing to show yet"
        description="Once you add an account and some transactions, your spending by category will appear here."
      >
        <Link
          href="/accounts"
          className="mt-4 rounded-full bg-foreground px-6 py-3 font-medium text-surface transition-opacity hover:opacity-85 active:opacity-70"
        >
          Add an account
        </Link>
      </EmptyState>
    </>
  );
}
