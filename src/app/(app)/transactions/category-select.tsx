import type { Category } from "@/lib/transactions";

/** <option>s for a category <select>, in your own order. */
export function CategoryOptions({
  categories,
  blankLabel = "Uncategorized",
}: {
  categories: Category[];
  blankLabel?: string;
}) {
  return (
    <>
      <option value="">{blankLabel}</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </>
  );
}
