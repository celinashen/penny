import { countryName, detectForeignCountry } from "./foreign";
import { merchantKey } from "./merchant-key";
import { CAT, type CategoryName } from "./names";
import { KEYWORDS, TRANSFER_PATTERN, fromPlaidCategory } from "./rules";

export { CAT, countryName, detectForeignCountry, merchantKey };
export type { CategoryName };

export type CategorizeInput = {
  description: string;
  merchant?: string | null;
  /** Signed: negative = money out, positive = money in. */
  amount: number;
  plaidCategory?: string | null;
  /** ISO alpha-2 country from Plaid, when the issuer provides one. */
  country?: string | null;
};

export type CategorizeResult = {
  categoryId: string | null;
  source: "auto" | "rule";
  /** Set for purchases abroad, e.g. "Italy". */
  note: string | null;
  /** ISO alpha-2 code for a purchase abroad. */
  country: string | null;
};

export type Category = { id: string; name: string };
export type MerchantRule = { merchant_key: string; category_id: string };

/** Best-guess category name (or null when we can't tell) plus travel info. */
export function guessCategory(
  input: CategorizeInput,
  ruleFor: (key: string) => string | undefined = () => undefined,
): { category: CategoryName | string | null; source: "auto" | "rule"; country: string | null } {
  const text = `${input.description} ${input.merchant ?? ""}`;
  const inflow = input.amount > 0;

  // 1. Card payments and moves between your own accounts stay out of spending.
  if (TRANSFER_PATTERN.test(text)) {
    return { category: CAT.transfer, source: "auto", country: null };
  }

  // 2. Anything bought outside the US and Canada is Travel.
  const country = detectForeignCountry({
    country: input.country,
    description: input.description,
  });
  if (country && !inflow) {
    return { category: CAT.travel, source: "auto", country };
  }

  // 3. Something you taught the app.
  const learned = ruleFor(merchantKey(input.description, input.merchant));
  if (learned) return { category: learned, source: "rule", country: null };

  // 4. Well-known merchants.
  for (const k of KEYWORDS) {
    if (k.sign === "in" && !inflow) continue;
    if (k.sign === "out" && inflow) continue;
    if (k.re.test(text)) return { category: k.category, source: "auto", country: null };
  }

  // 5. Plaid's own category.
  const plaid = fromPlaidCategory(input.plaidCategory);
  if (plaid) return { category: plaid, source: "auto", country: null };

  // 6. Unknown. Spending falls back to Other; unexplained money in is left
  //    uncategorized so it doesn't silently count as income.
  return { category: inflow ? null : CAT.other, source: "auto", country: null };
}

/**
 * Builds a categorizer for one user: their category ids and merchant rules go
 * in, and it returns a function that turns a transaction into a category id.
 */
export function createCategorizer(categories: Category[], rules: MerchantRule[]) {
  const idByName = new Map(categories.map((c) => [c.name, c.id]));
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const ruleByKey = new Map(rules.map((r) => [r.merchant_key, r.category_id]));

  return (input: CategorizeInput): CategorizeResult => {
    const guess = guessCategory(input, (key) => {
      const id = ruleByKey.get(key);
      return id ? nameById.get(id) : undefined;
    });
    return {
      categoryId: guess.category ? (idByName.get(guess.category) ?? null) : null,
      source: guess.source,
      note: guess.country ? countryName(guess.country) : null,
      country: guess.country,
    };
  };
}
