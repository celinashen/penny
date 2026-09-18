import Papa from "papaparse";

// Turns a bank's CSV export into clean transactions. Banks disagree on almost
// everything (header rows, date formats, whether a purchase is + or -), so each
// choice is detected and can be overridden in the UI.

export type Grid = string[][];

/** One import request carries every row, so cap it. */
export const MAX_IMPORT_ROWS = 10_000;

export type ColumnConfig = {
  dateCol: number;
  descCol: number;
  amountMode: "single" | "split";
  amountCol: number;
  debitCol: number;
  creditCol: number;
  categoryCol: number; // -1 = none
  /** Which sign the file uses for a purchase / money out. */
  spendingSign: "negative" | "positive";
  dateOrder: "mdy" | "dmy";
};

export type ImportRow = {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // signed: negative = money out
  category?: string;
};

export type Skipped = { line: number; reason: string };

export function parseCsvText(text: string): Grid {
  const { data } = Papa.parse<string[]>(text.replace(/^﻿/, ""), {
    skipEmptyLines: "greedy",
  });
  return data.map((row) => row.map((c) => (c ?? "").trim()));
}

const HEADER_HINTS = [
  /date/i,
  /desc|memo|payee|details|merchant|name/i,
  /amount|debit|credit|withdraw|deposit/i,
];

/**
 * Some exports start with account summaries before the real header, and some
 * (TD) have no header at all. Returns the header row's index, or -1.
 */
export function findHeaderRow(grid: Grid): number {
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const hits = HEADER_HINTS.filter((re) => grid[i].some((cell) => re.test(cell))).length;
    // A data row can contain a word like "Payment", but never a date AND an amount hint together.
    const looksLikeData = grid[i].some((c) => parseDate(c, "mdy") !== null);
    if (hits >= 2 && !looksLikeData) return i;
  }
  return -1;
}

const find = (headers: string[], ...patterns: RegExp[]) => {
  for (const re of patterns) {
    const i = headers.findIndex((h) => re.test(h));
    if (i >= 0) return i;
  }
  return -1;
};

export function guessColumns(headers: string[]): ColumnConfig {
  const debitCol = find(headers, /debit|withdraw|money out|paid out/i);
  const creditCol = find(headers, /^credit$|deposit|money in|paid in/i);
  const amountCol = find(headers, /^amount$/i, /amount/i);
  const split = amountCol < 0 && debitCol >= 0 && creditCol >= 0;

  return {
    dateCol: find(headers, /^(transaction date|trans\.? date)$/i, /^date$/i, /date/i),
    descCol: find(headers, /^description$/i, /^payee$/i, /^merchant$/i, /^name$/i, /details/i, /memo/i),
    amountMode: split ? "split" : "single",
    amountCol,
    debitCol,
    creditCol,
    categoryCol: find(headers, /^category$/i),
    spendingSign: "negative",
    dateOrder: "mdy",
  };
}

/**
 * For files with no header row: work out which column is which from the values.
 * Typical shape: date, description, debit, credit, balance.
 */
export function guessHeaderless(data: Grid): ColumnConfig {
  const width = Math.max(0, ...data.map((r) => r.length));
  const cols = Array.from({ length: width }, (_, i) => data.map((r) => r[i] ?? ""));
  const share = (values: string[], test: (v: string) => boolean) => {
    const filled = values.filter((v) => v.trim());
    return filled.length ? filled.filter(test).length / filled.length : 0;
  };

  const dateCol = cols.findIndex((c) => share(c, (v) => parseDate(v, "mdy") !== null || parseDate(v, "dmy") !== null) >= 0.8);
  const isNumber = (v: string) => parseAmount(v) !== null;
  const descCol = cols.findIndex((c, i) => i !== dateCol && share(c, isNumber) < 0.3);
  // Columns holding numbers, to the right of the description.
  const numeric = cols
    .map((c, i) => ({ i, filled: c.filter((v) => v.trim()).length }))
    .filter(({ i, filled }) => i > descCol && filled > 0 && share(cols[i], isNumber) >= 0.8)
    .map(({ i }) => i);

  const split = numeric.length >= 3;
  return {
    dateCol,
    descCol,
    amountMode: split ? "split" : "single",
    amountCol: numeric[0] ?? -1,
    debitCol: split ? numeric[0] : -1,
    creditCol: split ? numeric[1] : -1,
    categoryCol: -1,
    spendingSign: "negative",
    dateOrder: "mdy",
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

function validDate(y: number, m: number, d: number) {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
    ? `${y}-${pad(m)}-${pad(d)}`
    : null;
}

/** "2026-09-11", "9/11/2026", "11/09/26" (day first) or "Sep 11, 2026" -> "2026-09-11". */
export function parseDate(raw: string, order: "mdy" | "dmy"): string | null {
  const s = raw.trim();
  if (!s) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/.exec(s);
  if (iso) return validDate(+iso[1], +iso[2], +iso[3]);

  const slash = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (slash) {
    const [a, b] = [+slash[1], +slash[2]];
    const y = slash[3].length === 2 ? 2000 + +slash[3] : +slash[3];
    return order === "mdy" ? validDate(y, a, b) : validDate(y, b, a);
  }

  if (/[a-z]{3}/i.test(s)) {
    const t = new Date(s);
    if (!Number.isNaN(t.getTime())) return validDate(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }
  return null;
}

/** "$1,234.50", "(12.34)", "-12.34", "12.34-" -> number. */
export function parseAmount(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[A-Za-z$£€\s,]/g, "");
  if (s.endsWith("-")) {
    negative = true;
    s = s.slice(0, -1);
  }
  if (!/^[-+]?\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

/** Day-first if any date has a first number above 12, otherwise month-first. */
export function detectDateOrder(dates: string[]): "mdy" | "dmy" {
  for (const d of dates) {
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}$/.exec(d.trim());
    if (m && +m[1] > 12) return "dmy";
    if (m && +m[2] > 12) return "mdy";
  }
  return "mdy";
}

/** Purchases usually outnumber deposits, so the more common sign is "spending". */
export function detectSpendingSign(amounts: number[]): "negative" | "positive" {
  const positive = amounts.filter((a) => a > 0).length;
  const negative = amounts.filter((a) => a < 0).length;
  return positive > negative ? "positive" : "negative";
}

/** Guesses the sign convention and date order from the data rows themselves. */
export function detectFormat(dataRows: Grid, config: ColumnConfig): ColumnConfig {
  const dates = dataRows.map((r) => r[config.dateCol] ?? "");
  const amounts =
    config.amountMode === "single"
      ? dataRows.map((r) => parseAmount(r[config.amountCol] ?? "")).filter((n): n is number => n !== null)
      : [];
  return {
    ...config,
    dateOrder: detectDateOrder(dates),
    spendingSign: amounts.length ? detectSpendingSign(amounts) : config.spendingSign,
  };
}

export function normalizeRows(dataRows: Grid, config: ColumnConfig, firstLine = 1) {
  const rows: ImportRow[] = [];
  const skipped: Skipped[] = [];

  dataRows.forEach((r, i) => {
    const line = firstLine + i;
    const date = parseDate(r[config.dateCol] ?? "", config.dateOrder);
    if (!date) return void skipped.push({ line, reason: "Couldn’t read the date" });

    const description = (r[config.descCol] ?? "").trim();
    if (!description) return void skipped.push({ line, reason: "No description" });

    let amount: number | null;
    if (config.amountMode === "split") {
      const debit = parseAmount(r[config.debitCol] ?? "");
      const credit = parseAmount(r[config.creditCol] ?? "");
      if (debit === null && credit === null) {
        return void skipped.push({ line, reason: "No amount" });
      }
      amount = Math.abs(credit ?? 0) - Math.abs(debit ?? 0);
    } else {
      const raw = parseAmount(r[config.amountCol] ?? "");
      amount = raw === null ? null : config.spendingSign === "negative" ? raw : -raw;
    }
    if (amount === null) return void skipped.push({ line, reason: "Couldn’t read the amount" });
    // Avoid floating point dust such as 12.340000000000002.
    amount = Math.round(amount * 100) / 100;

    const category = config.categoryCol >= 0 ? (r[config.categoryCol] ?? "").trim() : "";
    rows.push({ date, description, amount, ...(category ? { category } : {}) });
  });

  return { rows, skipped };
}
