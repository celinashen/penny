import Link from "next/link";
import { Card } from "@/components/card";
import { ChangeCell } from "@/components/change-cell";
import type { Currency } from "@/lib/accounts";
import type { PaceResult } from "@/lib/pace";
import { formatMoneyWhole, monthShort, shiftMonth } from "@/lib/transactions";

const DASH = <span className="text-muted/60">&mdash;</span>;

/**
 * Every category's change from last month (MoM) and from the same month last
 * year (YoY), next to your 12-month average. While the month is still going,
 * both comparisons use the same days of the earlier month, so each is like with
 * like, and the projection shows where the month is expected to finish.
 */
export function CompareTable({
  currency,
  month,
  pace,
  colors,
  txHref,
}: {
  currency: Currency;
  month: string;
  pace: PaceResult;
  colors: Map<string, string>;
  txHref: (categoryId: string) => string;
}) {
  const prev = shiftMonth(month, -1);
  const yearAgo = shiftMonth(month, -12);
  const yearAgoLabel = `${monthShort(yearAgo)} ${yearAgo.slice(0, 4)}`;
  const { inProgress, hasHistory, hasLastYear, totals } = pace;
  const rows = pace.categories;
  const money = (n: number) => formatMoneyWhole(n, currency);

  const th = "px-2 pb-2 text-right font-normal";
  const td = "px-2 py-2.5 text-right tabular-nums";

  return (
    <Card
      title="Month over month and year over year"
      subtitle={
        inProgress
          ? `MoM is the change from ${monthShort(prev)} and YoY is the change from ${yearAgoLabel}, both over the same days so far.`
          : `MoM is the change from ${monthShort(prev)} and YoY is the change from ${yearAgoLabel}.`
      }
    >
      {rows.length === 0 ? (
        <p className="text-muted">Nothing to compare yet.</p>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="font-mono text-xs uppercase tracking-wider text-muted">
              <tr className="border-b border-line">
                <th className="px-1 pb-2 font-normal">Category</th>
                <th className={th}>
                  <abbr title={`Change from ${monthShort(prev)}`} className="no-underline">
                    MoM
                  </abbr>
                </th>
                <th className={th}>
                  <abbr title={`Change from ${yearAgoLabel}`} className="no-underline">
                    YoY
                  </abbr>
                </th>
                <th className={`${th} ${inProgress ? "" : "pr-1"}`}>Avg / month</th>
                {inProgress && <th className={`${th} pr-1`}>Projected</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="px-1 py-2.5">
                    <Link href={txHref(c.id)} className="group flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                        style={{ backgroundColor: colors.get(c.id) ?? "transparent" }}
                      />
                      <span className="min-w-0">
                        <span className="block whitespace-nowrap group-hover:underline">{c.name}</span>
                        <span className="block text-xs text-muted tabular-nums">
                          {money(c.spent)}
                          {inProgress ? " so far" : ""}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className={td}>
                    <ChangeCell now={c.spent} before={c.previous} currency={currency} />
                  </td>
                  <td className={td}>
                    {hasLastYear ? (
                      <ChangeCell now={c.spent} before={c.lastYear} currency={currency} />
                    ) : (
                      DASH
                    )}
                  </td>
                  <td className={`${td} text-muted ${inProgress ? "" : "pr-1"}`}>
                    {hasHistory ? money(c.average) : DASH}
                  </td>
                  {inProgress && (
                    <td className={`${td} pr-1`}>{hasHistory ? money(c.projected) : DASH}</td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line font-medium">
                <td className="px-1 pt-3">
                  <span className="block">Total spent</span>
                  <span className="block text-xs font-normal text-muted tabular-nums">
                    {money(totals.spent)}
                    {inProgress ? " so far" : ""}
                  </span>
                </td>
                <td className={`${td} pt-3`}>
                  <ChangeCell now={totals.spent} before={totals.previous} currency={currency} />
                </td>
                <td className={`${td} pt-3`}>
                  {hasLastYear ? (
                    <ChangeCell now={totals.spent} before={totals.lastYear} currency={currency} />
                  ) : (
                    DASH
                  )}
                </td>
                <td className={`${td} pt-3 text-muted ${inProgress ? "" : "pr-1"}`}>
                  {hasHistory ? money(totals.average) : DASH}
                </td>
                {inProgress && (
                  <td className={`${td} pt-3 pr-1`}>{hasHistory ? money(totals.projected) : DASH}</td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {rows.length > 0 && (!hasLastYear || !hasHistory) && (
        <p className="mt-4 text-sm text-muted">
          {!hasLastYear && "YoY appears once you have transactions from a year ago. "}
          {!hasHistory && "Averages appear once you have a few months of transactions."}
        </p>
      )}
    </Card>
  );
}
