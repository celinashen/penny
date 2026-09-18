import type { Currency } from "./accounts";
import type { AggRow } from "./spending";
import { shiftMonth } from "./transactions";

/** How many completed months make up "your average". */
export const BASELINE_MONTHS = 12;
/** Fewer months of history than this and the average isn't trustworthy. */
export const MIN_HISTORY_MONTHS = 3;
/** A category is "over" when it's projected above its average by at least this ratio... */
export const OVER_RATIO = 1.1;
/** ...and by at least this much money, so tiny categories don't cry wolf. */
export const OVER_MIN_AMOUNT = 25;
/** Categories that usually fill in late in the month (rent on the 29th) skip pace scaling. */
const LATE_FRACTION = 0.25;

/** Set when the month being viewed hasn't finished. */
export type Today = { day: number; daysInMonth: number };

export type PaceStatus = "over" | "ok" | "new" | "no-history";

export type CategoryPace = {
  id: string;
  name: string;
  /** This month so far (the whole month, once it's over). */
  spent: number;
  /** Last month: the same days when this month is in progress, otherwise all of it. */
  previous: number;
  /** The same month a year ago (the same days, while this month is in progress). */
  lastYear: number;
  /** A typical full month, averaged over your history. */
  average: number;
  /** A typical amount by this point in the month (same as `average` once it's over). */
  averageToDate: number;
  /** Where the month is expected to finish. */
  projected: number;
  status: PaceStatus;
  /** How far the projection is above your average, for categories that are over. */
  overBy: number;
};

export type PaceTotals = {
  spent: number;
  previous: number;
  lastYear: number;
  average: number;
  projected: number;
  over: boolean;
  overBy: number;
};

export type PaceResult = {
  inProgress: boolean;
  /** Completed months that went into the averages. */
  historyMonths: number;
  /** False until there's enough history for averages to mean anything. */
  hasHistory: boolean;
  /** Whether there's any data from the same month a year ago to compare with. */
  hasLastYear: boolean;
  categories: CategoryPace[];
  totals: PaceTotals;
};

const round = (n: number) => Math.round(n * 100) / 100;

type Bucket = { name: string; full: Record<string, number>; through: Record<string, number> };

/** The `count` months before `month`, oldest first. */
function monthsBefore(month: string, count: number) {
  return Array.from({ length: count }, (_, i) => shiftMonth(month, i - count));
}

function isOver(projected: number, average: number) {
  return projected > average * OVER_RATIO && projected - average >= OVER_MIN_AMOUNT;
}

/**
 * Compares a month's spending with your own history and projects where it will
 * finish.
 *
 * The average is over up to 12 completed months, counted from when your data
 * starts (a new account isn't diluted by empty months). The projection uses your
 * own timing: if you've usually spent 60% of a category by the 18th, and you're
 * at $300 today, it expects about $500. Categories that usually land late in the
 * month (rent) expect the rest of a typical month instead of being scaled up.
 *
 * Which rows count as spending matches `buildSeries`: transfers, income and
 * investment contributions are left out, refunds net against their category, and
 * uncategorized money coming in isn't counted.
 */
export function buildPace(input: {
  rows: AggRow[];
  currency: Currency;
  month: string;
  today: Today | null;
}): PaceResult {
  const { rows, currency, month, today } = input;
  const inProgress = today !== null;
  const previousMonth = shiftMonth(month, -1);
  const yearAgo = shiftMonth(month, -12);
  const baseline = monthsBefore(month, BASELINE_MONTHS);

  const buckets = new Map<string, Bucket>();
  let firstMonth: string | null = null;
  let hasLastYear = false;

  for (const r of rows) {
    if (r.currency !== currency) continue;
    // Any activity a year ago (income included) means there's a year to compare with.
    if (r.month === yearAgo) hasLastYear = true;
    // Any activity marks the start of your history, income included.
    if (baseline.includes(r.month) && (firstMonth === null || r.month < firstMonth)) {
      firstMonth = r.month;
    }

    if (r.kind === "transfer" || r.kind === "income" || r.kind === "investment") continue;
    if (r.category_id === null && !r.outflow) continue;

    const id = r.category_id ?? "uncategorized";
    const bucket =
      buckets.get(id) ?? { name: r.category_name ?? "Uncategorized", full: {}, through: {} };
    bucket.full[r.month] = (bucket.full[r.month] ?? 0) + -Number(r.total);
    bucket.through[r.month] = (bucket.through[r.month] ?? 0) + -Number(r.through_day);
    buckets.set(id, bucket);
  }

  const historyMonths =
    firstMonth === null ? 0 : baseline.filter((m) => m >= firstMonth!).length;
  const hasHistory = historyMonths >= MIN_HISTORY_MONTHS;
  const counted = firstMonth === null ? [] : baseline.filter((m) => m >= firstMonth!);

  const categories: CategoryPace[] = [];
  for (const [id, b] of buckets) {
    const sumFull = counted.reduce((t, m) => t + (b.full[m] ?? 0), 0);
    const sumThrough = counted.reduce((t, m) => t + (b.through[m] ?? 0), 0);
    const average = historyMonths > 0 ? sumFull / historyMonths : 0;
    const averageToDate = historyMonths > 0 ? sumThrough / historyMonths : 0;

    const spent = b.full[month] ?? 0;
    const previous = inProgress ? (b.through[previousMonth] ?? 0) : (b.full[previousMonth] ?? 0);
    const lastYear = inProgress ? (b.through[yearAgo] ?? 0) : (b.full[yearAgo] ?? 0);
    // Nothing worth showing: everything here rounds to $0 on screen.
    if (Math.max(Math.abs(spent), Math.abs(previous), Math.abs(lastYear), average) < 0.5) continue;

    let projected = spent;
    if (inProgress && hasHistory) {
      const spentSoFar = Math.max(0, spent);
      const usual = sumFull > 0 ? Math.min(1, Math.max(0, sumThrough / sumFull)) : null;
      if (usual === null) projected = spentSoFar;
      else if (usual >= LATE_FRACTION) projected = spentSoFar / usual;
      else projected = spentSoFar + (1 - usual) * average;
    }

    let status: PaceStatus = "ok";
    if (!hasHistory) status = "no-history";
    else if (average <= 0 && projected > 0) status = "new";
    else if (isOver(projected, average)) status = "over";

    categories.push({
      id,
      name: b.name,
      spent: round(spent),
      previous: round(previous),
      lastYear: round(lastYear),
      average: round(average),
      averageToDate: round(averageToDate),
      projected: round(projected),
      status,
      overBy: status === "over" ? round(projected - average) : 0,
    });
  }
  categories.sort((a, b) => b.spent - a.spent || b.average - a.average);

  const sum = (pick: (c: CategoryPace) => number) => round(categories.reduce((t, c) => t + pick(c), 0));
  const totals: PaceTotals = {
    spent: sum((c) => c.spent),
    previous: sum((c) => c.previous),
    lastYear: sum((c) => c.lastYear),
    average: sum((c) => c.average),
    projected: sum((c) => c.projected),
    over: false,
    overBy: 0,
  };
  totals.over = hasHistory && isOver(totals.projected, totals.average);
  totals.overBy = totals.over ? round(totals.projected - totals.average) : 0;

  return { inProgress, historyMonths, hasHistory, hasLastYear, categories, totals };
}

/** Categories running over their average, worst first. */
export function overspending(pace: PaceResult): CategoryPace[] {
  return pace.categories
    .filter((c) => c.status === "over")
    .sort((a, b) => b.overBy - a.overBy);
}

/**
 * Running total of spending for each day of the month up to `upTo`, carrying the
 * total forward over days with nothing spent. Index 0 is day 1.
 */
export function cumulativeByDay(
  daily: { day: string; total: number }[],
  upTo: number,
): number[] {
  const byDay = new Map<number, number>();
  for (const d of daily) {
    const dayOfMonth = Number(d.day.slice(8, 10));
    byDay.set(dayOfMonth, (byDay.get(dayOfMonth) ?? 0) + Number(d.total));
  }
  let running = 0;
  return Array.from({ length: upTo }, (_, i) => {
    running += byDay.get(i + 1) ?? 0;
    return round(running);
  });
}
