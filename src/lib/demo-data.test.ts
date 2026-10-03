import { describe, expect, it } from "vitest";
import {
  demoTransactionsForMonth,
  demoTransactionsThrough,
  previousMonth,
} from "./demo-data";

describe("demoTransactionsForMonth", () => {
  it("covers the whole month with income and spending", () => {
    const rows = demoTransactionsForMonth("2026-10");
    expect(rows.length).toBeGreaterThan(20);
    expect(rows.every((r) => r.posted_date.startsWith("2026-10-"))).toBe(true);
    expect(rows.some((r) => r.amount > 0)).toBe(true);
    expect(rows.some((r) => r.amount < 0)).toBe(true);
  });

  it("stops at the given day", () => {
    const rows = demoTransactionsForMonth("2026-10", 2);
    expect(rows.map((r) => r.posted_date)).toEqual(
      rows.map(() => expect.stringMatching(/^2026-10-0[12]$/)),
    );
    expect(rows.map((r) => r.description)).toContain("Paycheck");
  });

  it("gives every row a unique, stable external id", () => {
    const rows = demoTransactionsForMonth("2026-11");
    const ids = rows.map((r) => r.external_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(demoTransactionsForMonth("2026-11").map((r) => r.external_id)).toEqual(ids);
  });

  it("varies the one-off purchases from month to month", () => {
    const descriptions = (m: string) =>
      demoTransactionsForMonth(m).map((r) => r.description).join();
    expect(descriptions("2026-10")).not.toBe(descriptions("2026-11"));
  });
});

describe("demoTransactionsThrough", () => {
  it("finishes last month and fills this month up to today", () => {
    const rows = demoTransactionsThrough(new Date("2027-01-05T14:00:00Z"));
    const months = new Set(rows.map((r) => r.posted_date.slice(0, 7)));
    expect(months).toEqual(new Set(["2026-12", "2027-01"]));
    expect(rows.every((r) => r.posted_date <= "2027-01-05")).toBe(true);
  });
});

describe("demoTransactionsThrough before October 2026", () => {
  it("leaves the hand-entered months alone", () => {
    const rows = demoTransactionsThrough(new Date("2026-10-02T14:00:00Z"));
    expect(rows.every((r) => r.posted_date.startsWith("2026-10-"))).toBe(true);
  });
});

describe("previousMonth", () => {
  it("wraps across the year", () => {
    expect(previousMonth("2027-01")).toBe("2026-12");
    expect(previousMonth("2026-10")).toBe("2026-09");
  });
});
