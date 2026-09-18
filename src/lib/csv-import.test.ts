import { describe, expect, it } from "vitest";
import { csvExternalIds } from "./csv-identity";
import {
  detectDateOrder,
  detectFormat,
  findHeaderRow,
  guessColumns,
  guessHeaderless,
  normalizeRows,
  parseAmount,
  parseCsvText,
  parseDate,
} from "./csv-import";

/** Runs a whole file through the same steps the import page does. */
function run(text: string) {
  const grid = parseCsvText(text);
  const headerIndex = findHeaderRow(grid);
  const headers = headerIndex >= 0 ? grid[headerIndex] : grid[0].map((_, i) => `Column ${i + 1}`);
  const data = grid.slice(headerIndex + 1);
  const config = detectFormat(data, guessColumns(headers));
  return { config, ...normalizeRows(data, config) };
}

describe("parseDate", () => {
  it("reads common formats", () => {
    expect(parseDate("2026-09-11", "mdy")).toBe("2026-09-11");
    expect(parseDate("09/11/2026", "mdy")).toBe("2026-09-11");
    expect(parseDate("9/1/26", "mdy")).toBe("2026-09-01");
    expect(parseDate("11/09/2026", "dmy")).toBe("2026-09-11");
    expect(parseDate("Sep 11, 2026", "mdy")).toBe("2026-09-11");
  });

  it("rejects impossible dates", () => {
    expect(parseDate("02/31/2026", "mdy")).toBeNull();
    expect(parseDate("13/01/2026", "mdy")).toBeNull();
    expect(parseDate("hello", "mdy")).toBeNull();
    expect(parseDate("", "mdy")).toBeNull();
  });

  it("detects day-first files", () => {
    expect(detectDateOrder(["25/12/2026", "01/02/2026"])).toBe("dmy");
    expect(detectDateOrder(["12/25/2026", "01/02/2026"])).toBe("mdy");
    expect(detectDateOrder(["01/02/2026"])).toBe("mdy");
  });
});

describe("parseAmount", () => {
  it.each([
    ["12.34", 12.34],
    ["-12.34", -12.34],
    ["$1,234.50", 1234.5],
    ["(12.34)", -12.34],
    ["12.34-", -12.34],
    ["-$5.00", -5],
    ["CAD 7.25", 7.25],
  ])("%s -> %s", (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it("rejects non-numbers", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("n/a")).toBeNull();
    expect(parseAmount("1.2.3")).toBeNull();
  });
});

describe("real-world export layouts", () => {
  it("handles a card export where purchases are negative", () => {
    const csv = [
      "Transaction Date,Post Date,Description,Category,Type,Amount,Memo",
      "09/10/2026,09/11/2026,QFC #5847,Groceries,Sale,-42.10,",
      "09/09/2026,09/10/2026,PAYMENT THANK YOU,,Payment,500.00,",
      "09/08/2026,09/09/2026,STARBUCKS,Food & Drink,Sale,-6.75,",
    ].join("\n");
    const { config, rows, skipped } = run(csv);
    expect(config.spendingSign).toBe("negative");
    expect(config.dateCol).toBe(0); // Transaction Date, not Post Date
    expect(skipped).toEqual([]);
    expect(rows.map((r) => r.amount)).toEqual([-42.1, 500, -6.75]);
    expect(rows[0].date).toBe("2026-09-10");
    expect(rows[0].category).toBe("Groceries");
  });

  it("flips a card export where purchases are positive", () => {
    const csv = [
      "Date,Description,Amount",
      "09/10/2026,UBER TRIP,18.40",
      "09/09/2026,COFFEE,4.25",
      "09/08/2026,AUTOPAY PAYMENT,-200.00",
    ].join("\n");
    const { config, rows } = run(csv);
    expect(config.spendingSign).toBe("positive");
    expect(rows.map((r) => r.amount)).toEqual([-18.4, -4.25, 200]);
  });

  it("skips summary lines above the real header", () => {
    const csv = [
      "Description,,Summary Amt.",
      "Beginning balance as of 09/01/2026,,\"1,000.00\"",
      "",
      "Date,Description,Amount,Running Bal.",
      "09/02/2026,SHELL OIL,-31.00,969.00",
    ].join("\n");
    const grid = parseCsvText(csv);
    // Blank lines are dropped on parse, so the header is the third remaining row.
    expect(findHeaderRow(grid)).toBe(2);
    const { rows } = run(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe("SHELL OIL");
  });

  it("handles a headerless file with separate debit and credit columns", () => {
    // Some Canadian banks export: date, description, debit, credit, balance.
    const csv = [
      "09/10/2026,TIM HORTONS #123,4.50,,995.50",
      "09/09/2026,PAYROLL DEPOSIT,,2000.00,1000.00",
    ].join("\n");
    const grid = parseCsvText(csv);
    expect(findHeaderRow(grid)).toBe(-1);
    const guessed = guessHeaderless(grid);
    expect(guessed).toMatchObject({ dateCol: 0, descCol: 1, amountMode: "split", debitCol: 2, creditCol: 3 });
    const { rows } = normalizeRows(grid, detectFormat(grid, guessed));
    expect(rows.map((r) => r.amount)).toEqual([-4.5, 2000]);
  });

  it("guesses a headerless file with one amount column", () => {
    const csv = ["2026-09-10,COFFEE SHOP,-4.50", "2026-09-09,GROCERY,-30.00", "2026-09-08,SALARY,2000.00"].join("\n");
    const guessed = guessHeaderless(parseCsvText(csv));
    expect(guessed).toMatchObject({ dateCol: 0, descCol: 1, amountMode: "single", amountCol: 2 });
  });

  it("reports rows it can't read instead of silently dropping them", () => {
    const csv = ["Date,Description,Amount", "not a date,THING,5.00", "09/09/2026,,5.00", "09/09/2026,OK,5.00", "09/09/2026,BAD,abc"].join("\n");
    const { rows, skipped } = run(csv);
    expect(rows).toHaveLength(1);
    expect(skipped.map((s) => s.reason)).toEqual([
      "Couldn’t read the date",
      "No description",
      "Couldn’t read the amount",
    ]);
  });

  it("strips a byte-order mark and quoted commas", () => {
    const csv = "﻿Date,Description,Amount\n09/09/2026,\"SMITH, JOHN\",-10.00";
    const { rows } = run(csv);
    expect(rows[0].description).toBe("SMITH, JOHN");
  });
});

describe("duplicate detection", () => {
  const row = { date: "2026-09-10", description: "QFC #5847", amount: -42.1 };

  it("gives the same id when the same file is imported again", () => {
    expect(csvExternalIds("acct", [row])).toEqual(csvExternalIds("acct", [row]));
  });

  it("ignores case and spacing differences", () => {
    expect(csvExternalIds("a", [row])).toEqual(csvExternalIds("a", [{ ...row, description: "qfc  #5847" }]));
  });

  it("keeps two identical purchases on one day distinct", () => {
    const [a, b] = csvExternalIds("acct", [row, row]);
    expect(a).not.toBe(b);
  });

  it("separates accounts and amounts", () => {
    expect(csvExternalIds("a", [row])).not.toEqual(csvExternalIds("b", [row]));
    expect(csvExternalIds("a", [row])).not.toEqual(csvExternalIds("a", [{ ...row, amount: -42.11 }]));
  });

  it("is stable when an overlapping export re-lists the same rows", () => {
    const first = csvExternalIds("a", [row, { ...row, date: "2026-09-11" }]);
    const overlap = csvExternalIds("a", [{ ...row, date: "2026-09-11" }]);
    expect(first[1]).toBe(overlap[0]);
  });
});
