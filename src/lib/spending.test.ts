import { describe, expect, it } from "vitest";
import {
  OTHER_COLOR,
  SLOT_COLORS,
  assignColors,
  buildSeries,
  change,
  mergeCategoryTotals,
  monthsEndingAt,
  monthsYearToDate,
  savingsRate,
  toSlices,
  type AggRow,
} from "./spending";

const row = (over: Partial<AggRow>): AggRow => ({
  month: "2026-09",
  currency: "USD",
  category_id: "food",
  category_name: "Food & Drink",
  kind: "expense",
  outflow: true,
  total: -10,
  through_day: -10,
  txns: 1,
  ...over,
});

describe("month ranges", () => {
  it("lists the 12 months ending at a month, across a year boundary", () => {
    const months = monthsEndingAt("2026-02", 12);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2025-03");
    expect(months[11]).toBe("2026-02");
  });

  it("lists January through the current month for year-to-date", () => {
    expect(monthsYearToDate("2026-09")).toEqual([
      "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09",
    ]);
    expect(monthsYearToDate("2026-01")).toEqual(["2026-01"]);
  });
});

describe("buildSeries", () => {
  const months = ["2026-08", "2026-09"];

  it("totals spending per month and category", () => {
    const s = buildSeries(
      [
        row({ month: "2026-08", total: -30 }),
        row({ month: "2026-09", total: -20 }),
        row({ month: "2026-09", category_id: "groc", category_name: "Groceries", total: -80 }),
      ],
      "USD",
      months,
    );
    expect(s.spent).toEqual({ "2026-08": 30, "2026-09": 100 });
    expect(s.categories.map((c) => c.name)).toEqual(["Groceries", "Food & Drink"]); // biggest first
    expect(s.categories[1].byMonth).toEqual({ "2026-08": 30, "2026-09": 20 });
  });

  it("keeps currencies apart", () => {
    const rows = [row({ total: -50 }), row({ currency: "CAD", total: -7 })];
    expect(buildSeries(rows, "USD", months).spent["2026-09"]).toBe(50);
    expect(buildSeries(rows, "CAD", months).spent["2026-09"]).toBe(7);
  });

  it("ignores transfers and months outside the range", () => {
    const s = buildSeries(
      [
        row({ kind: "transfer", category_name: "Transfer", total: -500 }),
        row({ month: "2025-01", total: -999 }),
      ],
      "USD",
      months,
    );
    expect(s.spent["2026-09"]).toBe(0);
    expect(s.categories).toEqual([]);
  });

  it("nets a refund against its category instead of counting it as income", () => {
    const s = buildSeries(
      [
        row({ category_id: "clo", category_name: "Clothing", total: -100 }),
        row({ category_id: "clo", category_name: "Clothing", outflow: false, total: 39 }),
      ],
      "USD",
      months,
    );
    expect(s.spent["2026-09"]).toBe(61);
    expect(s.income["2026-09"]).toBe(0);
  });

  it("counts income, and leaves unexplained money in out of it", () => {
    const s = buildSeries(
      [
        row({ kind: "income", category_id: "inc", category_name: "Income", outflow: false, total: 4000 }),
        row({ category_id: null, category_name: null, kind: null, outflow: false, total: 12, txns: 2 }),
      ],
      "USD",
      months,
    );
    expect(s.income["2026-09"]).toBe(4000);
    expect(s.unreviewed["2026-09"]).toBe(2);
    expect(s.spent["2026-09"]).toBe(0);
  });

  it("reports investment contributions separately and keeps them out of spending", () => {
    const s = buildSeries(
      [
        row({ category_id: "inv", category_name: "Investments", kind: "investment", total: -500 }),
        row({ total: -40 }),
        row({ kind: "income", category_id: "inc", category_name: "Income", outflow: false, total: 3000 }),
      ],
      "USD",
      months,
    );
    expect(s.invested["2026-09"]).toBe(500);
    expect(s.spent["2026-09"]).toBe(40);
    expect(s.categories.map((c) => c.name)).toEqual(["Food & Drink"]);
  });

  it("nets money taken back out of investments against contributions", () => {
    const s = buildSeries(
      [
        row({ kind: "investment", category_id: "inv", category_name: "Investments", total: -500 }),
        row({ kind: "investment", category_id: "inv", category_name: "Investments", outflow: false, total: 120 }),
      ],
      "USD",
      months,
    );
    expect(s.invested["2026-09"]).toBe(380);
  });

  it("tracks contributions per month and per currency", () => {
    const s = buildSeries(
      [
        row({ month: "2026-08", kind: "investment", category_id: "inv", category_name: "Investments", total: -300 }),
        row({ month: "2026-09", kind: "investment", category_id: "inv", category_name: "Investments", total: -450 }),
        row({ currency: "CAD", kind: "investment", category_id: "inv", category_name: "Investments", total: -25 }),
      ],
      "USD",
      months,
    );
    expect(s.invested).toEqual({ "2026-08": 300, "2026-09": 450 });
  });

  it("groups uncategorized spending", () => {
    const s = buildSeries([row({ category_id: null, category_name: null, kind: null, total: -12 })], "USD", months);
    expect(s.categories[0]).toMatchObject({ id: "uncategorized", name: "Uncategorized", total: 12 });
  });

  it("fills every month, even ones with no activity", () => {
    const s = buildSeries([row({ month: "2026-09" })], "USD", months);
    expect(s.spent["2026-08"]).toBe(0);
    expect(s.categories[0].byMonth["2026-08"]).toBe(0);
  });

  it("does not accumulate floating point noise", () => {
    const s = buildSeries([row({ total: -0.1 }), row({ category_id: "b", category_name: "B", total: -0.2 })], "USD", months);
    expect(s.spent["2026-09"]).toBe(0.3);
  });
});

describe("change and savings rate", () => {
  it("reports the difference and percent", () => {
    expect(change(110, 100)).toEqual({ delta: 10, pct: 0.1 });
    expect(change(50, 100)).toEqual({ delta: -50, pct: -0.5 });
  });

  it("has no percent when there was nothing to compare with", () => {
    expect(change(40, 0)).toEqual({ delta: 40, pct: null });
    expect(change(0, 0)).toEqual({ delta: 0, pct: null });
  });

  it("computes the share of income kept", () => {
    expect(savingsRate(4000, 3000)).toBe(0.25);
    expect(savingsRate(1000, 1500)).toBe(-0.5);
    expect(savingsRate(0, 100)).toBeNull();
  });
});

describe("chart colors and slices", () => {
  const cats = [
    { id: "a", total: 900 }, { id: "b", total: 800 }, { id: "c", total: 700 }, { id: "d", total: 600 },
    { id: "e", total: 500 }, { id: "f", total: 400 }, { id: "g", total: 300 }, { id: "h", total: 200 },
  ];

  it("gives the six biggest categories a color each, and never invents a seventh", () => {
    const colors = assignColors(cats);
    expect(colors.size).toBe(6);
    expect(colors.get("a")).toBe(SLOT_COLORS[0]);
    expect(colors.get("f")).toBe(SLOT_COLORS[5]);
    expect(colors.has("g")).toBe(false);
  });

  it("keeps a category's color when other months change what is on screen", () => {
    const colors = assignColors(cats);
    const janSlices = toSlices([{ id: "b", name: "B", value: 5 }, { id: "a", name: "A", value: 1 }], colors);
    const febSlices = toSlices([{ id: "a", name: "A", value: 90 }], colors);
    expect(janSlices.find((s) => s.id === "a")?.color).toBe(febSlices[0].color);
  });

  it("folds categories without a color into a gray Other, preserving the total", () => {
    const colors = assignColors(cats);
    const slices = toSlices(
      [
        { id: "a", name: "A", value: 100 },
        { id: "g", name: "G", value: 30 },
        { id: "h", name: "H", value: 20 },
      ],
      colors,
    );
    expect(slices.map((s) => s.label)).toEqual(["A", "Everything else (2)"]);
    expect(slices[1]).toMatchObject({ value: 50, color: OTHER_COLOR });
    expect(slices.reduce((t, s) => t + s.value, 0)).toBe(150);
  });

  it("keeps a single folded category's own name so it can't be mistaken for 'Other'", () => {
    const slices = toSlices(
      [{ id: "a", name: "A", value: 100 }, { id: "g", name: "Transportation", value: 30 }],
      assignColors(cats),
    );
    expect(slices[1]).toMatchObject({ label: "Transportation", color: OTHER_COLOR });
  });

  it("gives a category the same color in every currency", () => {
    const usd = buildSeries([row({ category_id: "groc", category_name: "Groceries", total: -500 }), row({ total: -100 })], "USD", ["2026-09"]);
    const cad = buildSeries(
      [
        row({ currency: "CAD", category_id: "groc", category_name: "Groceries", total: -40 }),
        row({ currency: "CAD", total: -90 }),
      ],
      "CAD",
      ["2026-09"],
    );
    // Ranked on its own, CAD puts Food & Drink first, so Groceries would get the second color...
    expect(assignColors(cad.categories).get("groc")).toBe(SLOT_COLORS[1]);
    // ...but ranked together, Groceries keeps the first color in both currencies.
    const shared = assignColors(mergeCategoryTotals([usd, cad]));
    expect(shared.get("groc")).toBe(SLOT_COLORS[0]);
    expect(shared.get("food")).toBe(SLOT_COLORS[1]);
  });

  it("leaves out categories whose refunds cancelled their spending", () => {
    expect(toSlices([{ id: "a", name: "A", value: -5 }], assignColors(cats))).toEqual([]);
  });
});
