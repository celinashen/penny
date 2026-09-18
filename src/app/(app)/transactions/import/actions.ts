"use server";

import { revalidatePath } from "next/cache";
import { createCategorizer } from "@/lib/categorize";
import { csvExternalIds } from "@/lib/csv-identity";
import { MAX_IMPORT_ROWS, type ImportRow } from "@/lib/csv-import";
import { createClient } from "@/lib/supabase/server";

export type ImportResult = {
  error?: string;
  imported?: number;
  duplicates?: number;
  abroad?: number;
  needsReview?: number;
};

const CHUNK = 500;

const valid = (r: ImportRow) =>
  /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
  typeof r.description === "string" &&
  r.description.trim().length > 0 &&
  Number.isFinite(r.amount) &&
  Math.abs(r.amount) < 1_000_000_000;

export async function importTransactions(input: {
  accountId: string;
  rows: ImportRow[];
}): Promise<ImportResult> {
  const { accountId, rows } = input;
  if (typeof accountId !== "string" || !accountId) return { error: "Pick an account." };
  if (!Array.isArray(rows) || rows.length === 0) return { error: "There’s nothing to import." };
  if (rows.length > MAX_IMPORT_ROWS) {
    return { error: `That file has too many rows. Import at most ${MAX_IMPORT_ROWS.toLocaleString("en-US")} at a time.` };
  }
  if (!rows.every(valid)) return { error: "Some rows are invalid. Check the column choices and try again." };

  const supabase = await createClient();

  // Row-level security means this only finds accounts that belong to you.
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .single();
  if (!account) return { error: "Couldn’t find that account." };

  const [cats, rules] = await Promise.all([
    supabase.from("categories").select("id, name"),
    supabase.from("merchant_rules").select("merchant_key, category_id"),
  ]);
  if (cats.error || rules.error) return { error: "Couldn’t load your categories." };

  const categorize = createCategorizer(cats.data ?? [], rules.data ?? []);
  const byName = new Map((cats.data ?? []).map((c) => [c.name.toLowerCase(), c.id]));

  const ids = csvExternalIds(accountId, rows);
  let abroad = 0;
  let needsReview = 0;

  const records = rows.map((r, i) => {
    const description = r.description.trim().slice(0, 200);
    // A category column in the file wins when it matches one of yours.
    const fromFile = r.category ? byName.get(r.category.trim().toLowerCase()) : undefined;
    const guess = categorize({ description, amount: r.amount });

    if (guess.country) abroad++;
    const category_id = fromFile ?? guess.categoryId;
    if (!category_id) needsReview++;

    return {
      account_id: accountId,
      posted_date: r.date,
      description,
      amount: r.amount,
      external_id: ids[i],
      source: "csv",
      category_id,
      category_source: fromFile ? "import" : guess.source,
      notes: guess.note,
      country: guess.country,
    };
  });

  let imported = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    const { data, error } = await supabase
      .from("transactions")
      .upsert(records.slice(i, i + CHUNK), {
        onConflict: "account_id,external_id",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) {
      return {
        error: `Stopped after importing ${imported} rows because something went wrong. Importing the same file again is safe: rows already imported are skipped.`,
      };
    }
    imported += data?.length ?? 0;
  }

  revalidatePath("/transactions");
  revalidatePath("/");
  return { imported, duplicates: rows.length - imported, abroad, needsReview };
}
