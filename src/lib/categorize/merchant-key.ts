const NOISE = new Set([
  "sq", "tst", "sp", "pp", "paypal", "pos", "purchase", "debit", "card",
  "checkcard", "recurring", "payment", "www", "com",
]);

/**
 * A stable key for "the same merchant": lowercase words only, no store numbers
 * or processor prefixes, first three words. "QFC #5847 (Grocery)" and
 * "QFC #1204" both become "qfc".
 */
export function merchantKey(description: string, merchant?: string | null) {
  const base = (merchant?.trim() || description).toLowerCase();
  const words = base
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !NOISE.has(w));
  return words.slice(0, 3).join(" ") || base.trim().slice(0, 30);
}
