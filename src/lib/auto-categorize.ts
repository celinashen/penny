import type { SupabaseClient } from "@supabase/supabase-js";
import { createCategorizer } from "@/lib/categorize";

const PAGE = 1000;

/** Stop well before a serverless request's hard limit; the rest can be picked up next time. */
export const AUTO_CATEGORIZE_BUDGET_MS = 40_000;

/**
 * Best-guess categories for transactions that have none yet (for example ones
 * synced before categorization existed). Only rows still on "auto" are touched,
 * so nothing you chose by hand, imported, or taught as a rule is overwritten.
 * Returns how many were categorized and how many couldn't be guessed. If time
 * runs out with rows left, `more` is true and running it again continues.
 */
export async function autoCategorize(
  supabase: SupabaseClient,
  budgetMs: number = AUTO_CATEGORIZE_BUDGET_MS,
) {
  const deadline = Date.now() + budgetMs;
  const [cats, rules] = await Promise.all([
    supabase.from("categories").select("id, name"),
    supabase.from("merchant_rules").select("merchant_key, category_id"),
  ]);
  if (cats.error || rules.error) throw new Error("Couldn’t load your categories.");
  const categorize = createCategorizer(cats.data ?? [], rules.data ?? []);

  let categorized = 0;
  let unresolved = 0;
  let more = false;
  let lastId: string | null = null;

  // Page by id: rows we can't guess stay uncategorized, so re-querying "all
  // uncategorized" would never finish.
  for (;;) {
    if (Date.now() >= deadline) {
      more = true;
      break;
    }
    let query = supabase
      .from("transactions")
      .select("id, description, merchant, amount, plaid_category, country, notes")
      .is("category_id", null)
      .eq("category_source", "auto")
      .order("id")
      .limit(PAGE);
    if (lastId) query = query.gt("id", lastId);
    const { data, error } = await query;
    if (error) throw new Error("Couldn’t read your transactions.");
    if (!data || data.length === 0) break;
    lastId = data[data.length - 1].id;

    // Rows sharing a category and source can be updated together.
    const groups = new Map<string, { categoryId: string; source: string; ids: string[] }>();
    for (const t of data) {
      const guess = categorize({
        description: t.description,
        merchant: t.merchant,
        amount: Number(t.amount),
        plaidCategory: t.plaid_category,
        country: t.country,
      });
      if (!guess.categoryId) {
        unresolved++;
        continue;
      }

      if (guess.country) {
        // Purchases abroad also record the country, and a note if there isn't one.
        const { error: updateError } = await supabase
          .from("transactions")
          .update({
            category_id: guess.categoryId,
            category_source: guess.source,
            country: guess.country,
            ...(t.notes ? {} : { notes: guess.note }),
          })
          .eq("id", t.id);
        if (updateError) throw new Error("Couldn’t save the categories.");
        categorized++;
        continue;
      }

      const key = `${guess.categoryId}:${guess.source}`;
      const group = groups.get(key) ?? { categoryId: guess.categoryId, source: guess.source, ids: [] };
      group.ids.push(t.id);
      groups.set(key, group);
    }

    for (const g of groups.values()) {
      for (let i = 0; i < g.ids.length; i += 100) {
        const { error: updateError } = await supabase
          .from("transactions")
          .update({ category_id: g.categoryId, category_source: g.source })
          .in("id", g.ids.slice(i, i + 100));
        if (updateError) throw new Error("Couldn’t save the categories.");
      }
      categorized += g.ids.length;
    }

    if (data.length < PAGE) break;
  }

  return { categorized, unresolved, more };
}
