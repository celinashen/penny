import type { Currency } from "./accounts";

export type CurrencyView = {
  /** Currencies to render, in order. */
  shown: Currency[];
  /** What the toggle shows as selected: "both" or one currency. */
  mode: "both" | Currency;
  /** Toggle options. Empty when there is only one currency, so no toggle is needed. */
  options: { value: "both" | Currency; label: string }[];
};

const ORDER: Currency[] = ["USD", "CAD"];

/**
 * Decides which currencies a page shows. With both in play, the default is
 * both (side by side, never added together) and the toggle can pick one.
 */
export function resolveCurrencyView(param: string, available: Currency[]): CurrencyView {
  const currencies = ORDER.filter((c) => available.includes(c));
  if (currencies.length === 0) return { shown: ["USD"], mode: "USD", options: [] };
  if (currencies.length === 1) return { shown: currencies, mode: currencies[0], options: [] };

  const picked = currencies.find((c) => c === param);
  return {
    shown: picked ? [picked] : currencies,
    mode: picked ?? "both",
    options: [
      { value: "both", label: "Both" },
      ...currencies.map((c) => ({ value: c, label: c })),
    ],
  };
}
