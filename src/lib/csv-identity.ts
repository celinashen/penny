import { createHash } from "node:crypto";

/**
 * Stable ids for imported rows, so importing the same file (or an overlapping
 * export) twice never creates duplicates. Two genuinely identical rows on the
 * same day get distinct ids by counting occurrences within the file.
 */
export function csvExternalIds(
  accountId: string,
  rows: { date: string; description: string; amount: number }[],
): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const identity = [
      accountId,
      r.date,
      Math.round(r.amount * 100),
      r.description.toLowerCase().replace(/\s+/g, " ").trim(),
    ].join("|");
    const occurrence = (seen.get(identity) ?? 0) + 1;
    seen.set(identity, occurrence);
    const hash = createHash("sha256").update(identity).digest("hex").slice(0, 32);
    return `csv:${hash}:${occurrence}`;
  });
}
