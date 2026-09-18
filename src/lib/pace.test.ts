import { describe, expect, it } from "vitest";
import { buildPace, cumulativeByDay, overspending } from "./pace";
import { monthsEndingAt, type AggRow } from "./spending";

const MONTH = "2026-09";
const TODAY = { day: 18, daysInMonth: 30 };
const priorMonths = monthsEndingAt("2026-08", 12); // Sep 2025 .. Aug 2026

const cat = (id: string, name: string) => ({ category_id: id, category_name: name, kind: "expense" as const });

/** One row: `full` spent over the month, of which `through` by day 18 (positive amounts here). */
function row(month: string, id: string, name: string, full: number, through: number, over: Partial<AggRow> = {}): AggRow {
  return {
    month, currency: "USD", ...cat(id, name), outflow: true,
    total: -full, through_day: -through, txns: 3, ...over,
  };
}

/** The same category in every prior month. */
const history = (id: string, name: string, full: number, through: number, months = priorMonths) =>
  months.map((m) => row(m, id, name, full, through));

describe("averages", () => {
  it("averages a category over your completed months", () => {
    const rows = [...history("groc", "Groceries", 400, 240)];
    const pace = buildPace({ rows, currency: "USD", month: MONTH, today: TODAY });
    const groc = pace.categories.find((c) => c.id === "groc")!;
    expect(pace.historyMonths).toBe(12);
    expect(groc.average).toBe(400);
    expect(groc.averageToDate).toBe(240);
  });

  it("counts months from when your data starts, so a young history isn't diluted", () => {
    const recent = priorMonths.slice(-5); // only the last 5 months exist
    const pace = buildPace({ rows: history("groc", "Groceries", 500, 300, recent), currency: "USD", month: MONTH, today: TODAY });
    expect(pace.historyMonths).toBe(5);
    expect(pace.categories[0].average).toBe(500); // 2500 / 5, not / 12
  });

  it("includes months where a category had nothing, so lumpy spending averages out", () => {
    const rows = [
      ...history("groc", "Groceries", 400, 240),
      row("2026-03", "trav", "Travel", 1200, 1200),
      row("2026-07", "trav", "Travel", 600, 600),
    ];
    const travel = buildPace({ rows, currency: "USD", month: MONTH, today: TODAY }).categories.find((c) => c.id === "trav")!;
    expect(travel.average).toBe(150); // 1800 over 12 months
  });

  it("keeps currencies apart", () => {
    const rows = [...history("groc", "Groceries", 400, 240), ...history("groc", "Groceries", 90, 50).map((r) => ({ ...r, currency: "CAD" as const }))];
    expect(buildPace({ rows, currency: "CAD", month: MONTH, today: TODAY }).categories[0].average).toBe(90);
  });
});

describe("projecting the month", () => {
  it("scales an evenly spread category by your usual pace", () => {
    // Usually 60% spent by the 18th. $300 so far -> about $500.
    const rows = [...history("groc", "Groceries", 400, 240), row(MONTH, "groc", "Groceries", 300, 300)];
    const groc = buildPace({ rows, currency: "USD", month: MONTH, today: TODAY }).categories[0];
    expect(groc.projected).toBe(500);
    expect(groc.status).toBe("over"); // 500 vs a 400 average
    expect(groc.overBy).toBe(100);
  });

  it("does not inflate a category that is usually all paid at the start (rent)", () => {
    const rows = [...history("rent", "Rent", 1799, 1799), row(MONTH, "rent", "Rent", 1799, 1799)];
    const rent = buildPace({ rows, currency: "USD", month: MONTH, today: TODAY }).categories[0];
    expect(rent.projected).toBe(1799);
    expect(rent.status).toBe("ok");
  });

  it("expects a late category to arrive as usual instead of extrapolating from zero", () => {
    // Usually nothing before the 18th, then $600 later in the month.
    const rows = history("util", "Utilities", 600, 0);
    const util = buildPace({ rows, currency: "USD", month: MONTH, today: TODAY }).categories[0];
    expect(util.spent).toBe(0);
    expect(util.projected).toBe(600);
    expect(util.status).toBe("ok");
  });

  it("never projects below what is already spent", () => {
    const rows = [...history("food", "Food", 400, 400), row(MONTH, "food", "Food", 470, 470)];
    expect(buildPace({ rows, currency: "USD", month: MONTH, today: TODAY }).categories[0].projected).toBeGreaterThanOrEqual(470);
  });

  it("does not flag a category that is on pace", () => {
    const rows = [...history("groc", "Groceries", 400, 240), row(MONTH, "groc", "Groceries", 240, 240)];
    const groc = buildPace({ rows, currency: "USD", month: MONTH, today: TODAY }).categories[0];
    expect(groc.projected).toBe(400);
    expect(groc.status).toBe("ok");
  });

  it("ignores small overages so tiny categories don't cry wolf", () => {
    // $10 average, projected $19: over by 90%, but only $9.
    const rows = [...history("misc", "Misc", 10, 6), row(MONTH, "misc", "Misc", 11.4, 11.4)];
    expect(buildPace({ rows, currency: "USD", month: MONTH, today: TODAY }).categories[0].status).toBe("ok");
  });

  it("marks spending in a category with no history as new, not over", () => {
    const rows = [...history("groc", "Groceries", 400, 240), row(MONTH, "gift", "Gifts", 80, 80)];
    const gifts = buildPace({ rows, currency: "USD", month: MONTH, today: TODAY }).categories.find((c) => c.id === "gift")!;
    expect(gifts.status).toBe("new");
  });
});

describe("not enough history", () => {
  it("makes no over/under calls with under three months of data", () => {
    const rows = [...history("groc", "Groceries", 400, 240, priorMonths.slice(-2)), row(MONTH, "groc", "Groceries", 900, 900)];
    const pace = buildPace({ rows, currency: "USD", month: MONTH, today: TODAY });
    expect(pace.hasHistory).toBe(false);
    expect(pace.categories[0].status).toBe("no-history");
    expect(pace.categories[0].projected).toBe(900); // just what's spent, no guessing
    expect(overspending(pace)).toEqual([]);
  });

  it("copes with no history at all", () => {
    const pace = buildPace({ rows: [row(MONTH, "groc", "Groceries", 50, 50)], currency: "USD", month: MONTH, today: TODAY });
    expect(pace.historyMonths).toBe(0);
    expect(pace.totals.over).toBe(false);
  });
});

describe("month-over-month", () => {
  // Every prior month except August, which each test sets explicitly.
  const exceptAugust = priorMonths.filter((m) => m !== "2026-08");

  it("compares with the same days of last month while this month is in progress", () => {
    const rows = [
      ...history("groc", "Groceries", 400, 240, exceptAugust),
      row("2026-08", "groc", "Groceries", 500, 260), // 260 of last month's 500 by the 18th
      row(MONTH, "groc", "Groceries", 300, 300),
    ];
    const g = buildPace({ rows, currency: "USD", month: MONTH, today: TODAY }).categories.find((c) => c.id === "groc")!;
    expect(g.previous).toBe(260);
  });

  it("compares full months once the month is over", () => {
    const rows = [
      ...history("groc", "Groceries", 400, 240, exceptAugust),
      row("2026-08", "groc", "Groceries", 500, 260),
      row(MONTH, "groc", "Groceries", 450, 300),
    ];
    const pace = buildPace({ rows, currency: "USD", month: MONTH, today: null });
    expect(pace.inProgress).toBe(false);
    const g = pace.categories.find((c) => c.id === "groc")!;
    expect(g.previous).toBe(500);
    expect(g.projected).toBe(450); // the actual, since nothing is left to project
  });
});

describe("year-over-year", () => {
  // Every prior month except the same month a year ago, which each test sets explicitly.
  const exceptYearAgo = priorMonths.filter((m) => m !== "2025-09");

  it("compares with the same days of the same month last year while this month is in progress", () => {
    const rows = [
      ...history("groc", "Groceries", 400, 240, exceptYearAgo),
      row("2025-09", "groc", "Groceries", 300, 100), // 100 of that month's 300 by the 18th
      row(MONTH, "groc", "Groceries", 250, 250),
    ];
    const pace = buildPace({ rows, currency: "USD", month: MONTH, today: TODAY });
    expect(pace.categories[0].lastYear).toBe(100);
    expect(pace.totals.lastYear).toBe(100);
    expect(pace.hasLastYear).toBe(true);
  });

  it("compares full months once the month is over", () => {
    const rows = [
      ...history("groc", "Groceries", 400, 240, exceptYearAgo),
      row("2025-09", "groc", "Groceries", 300, 100),
      row(MONTH, "groc", "Groceries", 450, 300),
    ];
    const pace = buildPace({ rows, currency: "USD", month: MONTH, today: null });
    expect(pace.categories[0].lastYear).toBe(300);
  });

  it("treats a category that didn't exist a year ago as zero, not as missing data", () => {
    const rows = [
      ...history("groc", "Groceries", 400, 240),
      row(MONTH, "gift", "Gifts", 80, 80),
    ];
    const pace = buildPace({ rows, currency: "USD", month: MONTH, today: TODAY });
    expect(pace.hasLastYear).toBe(true);
    expect(pace.categories.find((c) => c.id === "gift")?.lastYear).toBe(0);
  });

  it("has nothing to compare with when there is no data from a year ago", () => {
    const rows = [
      ...history("groc", "Groceries", 400, 240, priorMonths.slice(-6)), // only the last 6 months exist
      row(MONTH, "groc", "Groceries", 300, 300),
    ];
    const pace = buildPace({ rows, currency: "USD", month: MONTH, today: TODAY });
    expect(pace.hasLastYear).toBe(false);
    expect(pace.categories[0].lastYear).toBe(0);
  });

  it("counts a year ago as data even if it was only income", () => {
    const rows = [
      { ...row("2025-09", "inc", "Income", 4000, 4000), kind: "income" as const, outflow: false, total: 4000, through_day: 4000 },
      ...history("groc", "Groceries", 400, 240, exceptYearAgo),
    ];
    expect(buildPace({ rows, currency: "USD", month: MONTH, today: TODAY }).hasLastYear).toBe(true);
  });

  it("only looks at the right currency", () => {
    const rows = [
      ...history("groc", "Groceries", 400, 240),
      ...history("groc", "Groceries", 90, 50, exceptYearAgo).map((r) => ({ ...r, currency: "CAD" as const })),
    ];
    expect(buildPace({ rows, currency: "CAD", month: MONTH, today: TODAY }).hasLastYear).toBe(false);
  });
});

describe("what counts as spending", () => {
  it("leaves out transfers, income and investment contributions, and unexplained credits", () => {
    const rows = [
      ...history("groc", "Groceries", 400, 240),
      { ...row(MONTH, "x", "Transfer", 500, 500), kind: "transfer" as const },
      { ...row(MONTH, "i", "Income", 3000, 3000), kind: "income" as const, outflow: false, total: 3000, through_day: 3000 },
      { ...row(MONTH, "inv", "Investments", 300, 300), kind: "investment" as const },
      { ...row(MONTH, "u", "?", 9, 9), category_id: null, category_name: null, kind: null, outflow: false, total: 9, through_day: 9 },
    ];
    const pace = buildPace({ rows, currency: "USD", month: MONTH, today: TODAY });
    expect(pace.categories.map((c) => c.id)).toEqual(["groc"]);
  });

  it("nets refunds against their category", () => {
    const rows = [
      ...history("clo", "Clothing", 100, 60),
      row(MONTH, "clo", "Clothing", 100, 100),
      row(MONTH, "clo", "Clothing", -39, -39, { outflow: false }), // a refund
    ];
    expect(buildPace({ rows, currency: "USD", month: MONTH, today: TODAY }).categories[0].spent).toBe(61);
  });

  it("hides categories where everything rounds to zero", () => {
    // Fifty cents once, a year ago: an average of about four cents a month.
    const rows = [...history("groc", "Groceries", 400, 240), row("2025-10", "dust", "Dust", 0.5, 0.5)];
    const pace = buildPace({ rows, currency: "USD", month: MONTH, today: TODAY });
    expect(pace.categories.map((c) => c.id)).toEqual(["groc"]);
  });

  it("shows a category you usually spend in even when nothing is spent yet", () => {
    const pace = buildPace({ rows: history("groc", "Groceries", 400, 240), currency: "USD", month: MONTH, today: TODAY });
    expect(pace.categories[0]).toMatchObject({ spent: 0, average: 400 });
  });
});

describe("totals and ranking", () => {
  it("adds up categories and flags the month when the total is over", () => {
    const rows = [
      ...history("groc", "Groceries", 400, 240), row(MONTH, "groc", "Groceries", 300, 300),
      ...history("rent", "Rent", 1800, 1800), row(MONTH, "rent", "Rent", 1800, 1800),
    ];
    const pace = buildPace({ rows, currency: "USD", month: MONTH, today: TODAY });
    expect(pace.totals.average).toBe(2200);
    expect(pace.totals.projected).toBe(2300);
    expect(pace.totals.over).toBe(false); // +4.5%: under the 10% bar
  });

  it("ranks the worst overspending first", () => {
    const rows = [
      ...history("a", "A", 400, 240), row(MONTH, "a", "A", 300, 300), // projects 500: over by 100
      ...history("b", "B", 400, 240), row(MONTH, "b", "B", 450, 450), // projects 750: over by 350
    ];
    const pace = buildPace({ rows, currency: "USD", month: MONTH, today: TODAY });
    expect(overspending(pace).map((c) => c.id)).toEqual(["b", "a"]);
  });
});

describe("cumulativeByDay", () => {
  it("builds a running total and carries it over quiet days", () => {
    const daily = [
      { day: "2026-09-01", total: 100 },
      { day: "2026-09-03", total: 50 },
      { day: "2026-09-03", total: 25 },
    ];
    expect(cumulativeByDay(daily, 5)).toEqual([100, 100, 175, 175, 175]);
  });

  it("is all zeros when nothing was spent", () => {
    expect(cumulativeByDay([], 3)).toEqual([0, 0, 0]);
  });
});
