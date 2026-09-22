import Link from "next/link";
import { formatDay } from "@/lib/transactions";

export type TripSuggestion = {
  /** Country names (not codes), e.g. ["Italy"]. */
  countries: string[];
  count: number;
  from: string;
  to: string;
};

function listCountries(names: string[]) {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function TripBanner({ suggestion }: { suggestion: TripSuggestion }) {
  const range =
    suggestion.from === suggestion.to
      ? formatDay(suggestion.from)
      : `${formatDay(suggestion.from)} – ${formatDay(suggestion.to)}`;

  return (
    <Link
      href="/transactions?foreign=1"
      className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-4 transition-colors hover:bg-raised"
    >
      <p>
        <span className="font-medium">Looks like you recently traveled</span>{" "}
        <span className="text-muted">
          &mdash; {suggestion.count} purchase{suggestion.count === 1 ? "" : "s"} in{" "}
          {listCountries(suggestion.countries)} ({range}) {suggestion.count === 1 ? "isn't" : "aren't"} on a
          trip yet.
        </span>
      </p>
      <span className="shrink-0 font-medium underline underline-offset-4">Create a trip &rarr;</span>
    </Link>
  );
}
