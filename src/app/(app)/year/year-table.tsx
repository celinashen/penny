import Link from "next/link";
import type { Currency } from "@/lib/accounts";
import type { Series } from "@/lib/spending";
import { ScrollToEnd } from "@/components/scroll-to-end";
import { formatMoneyWhole, monthShort } from "@/lib/transactions";

const EMPTY = <span className="text-muted/60">&mdash;</span>;

/**
 * Spending for every category in every month. Cells are shaded lightly by how
 * large they are within their own row, so a spike stands out without the
 * numbers ever being hidden. This is also the table view of the charts above.
 */
export function YearTable({
  currency,
  series,
  colors,
  txHref,
  allCategories,
}: {
  currency: Currency;
  series: Series;
  colors: Map<string, string>;
  txHref: (categoryId: string, month: string) => string;
  /** Spending categories to list even when nothing was spent in them, as dashes. */
  allCategories?: { id: string; name: string }[];
}) {
  const { months } = series;
  const rows = series.categories.filter((c) => c.total !== 0);
  const withData = new Set(rows.map((c) => c.id));
  const emptyRows = (allCategories ?? []).filter((c) => !withData.has(c.id));
  const cell = "whitespace-nowrap px-1 py-2.5 text-right tabular-nums";
  const sticky = "sticky left-0 z-10 border-r border-line bg-surface";
  // The total stays in view while the months scroll underneath.
  const stickyEnd = "sticky right-0 z-10 border-l border-line bg-surface";

  const money = (n: number) => (n === 0 ? EMPTY : formatMoneyWhole(n, currency));
  const netByMonth = months.map((m) => Math.round(((series.income[m] ?? 0) - (series.spent[m] ?? 0)) * 100) / 100);
  const spentTotal = months.reduce((t, m) => t + (series.spent[m] ?? 0), 0);
  const incomeTotal = months.reduce((t, m) => t + (series.income[m] ?? 0), 0);
  const investedTotal = months.reduce((t, m) => t + (series.invested[m] ?? 0), 0);

  return (
    <ScrollToEnd className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-max text-[0.8125rem]">
        <thead>
          <tr className="border-b border-line font-mono text-xs uppercase tracking-wider text-muted">
            <th scope="col" className={`${sticky} px-3 py-3 text-left font-normal`}>
              Category
            </th>
            {months.map((m) => (
              <th key={m} scope="col" className="px-1 py-3 text-right font-normal">
                <span className="block">{monthShort(m)}</span>
                <span className="block text-[0.6rem] normal-case tracking-normal text-muted/70">
                  {m.slice(0, 4)}
                </span>
              </th>
            ))}
            <th scope="col" className={`${stickyEnd} px-3 py-3 text-right font-normal`}>
              Total
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-line">
          {rows.map((c) => {
            const values = months.map((m) => c.byMonth[m] ?? 0);
            const rowMax = Math.max(...values);
            const rowMin = Math.min(...values);
            return (
              <tr key={c.id}>
                <th scope="row" className={`${sticky} px-3 py-2.5 text-left font-normal`}>
                  <span className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: colors.get(c.id) ?? "transparent" }}
                    />
                    <span className="whitespace-nowrap">{c.name}</span>
                  </span>
                </th>
                {months.map((m) => {
                  const v = c.byMonth[m] ?? 0;
                  // Shade by how far above the row's own low point a cell sits, so a
                  // flat row (rent) stays light and only real peaks get dark.
                  const shade =
                    v > 0 ? 0.04 + (rowMax > rowMin ? 0.22 * ((v - rowMin) / (rowMax - rowMin)) : 0) : 0;
                  return (
                    <td
                      key={m}
                      className={cell}
                      style={shade ? { backgroundColor: `rgba(10, 125, 85, ${shade.toFixed(3)})` } : undefined}
                    >
                      {v === 0 ? (
                        EMPTY
                      ) : (
                        <Link href={txHref(c.id, m)} className="hover:underline">
                          {formatMoneyWhole(v, currency)}
                        </Link>
                      )}
                    </td>
                  );
                })}
                <td className={`${cell} ${stickyEnd} px-3 font-medium`}>{formatMoneyWhole(c.total, currency)}</td>
              </tr>
            );
          })}

          {/* Categories with nothing spent, so the whole list is always visible. */}
          {emptyRows.map((c) => (
            <tr key={c.id} className="text-muted">
              <th scope="row" className={`${sticky} px-3 py-2.5 text-left font-normal`}>
                <span className="flex items-center gap-2.5">
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0" />
                  <span className="whitespace-nowrap">{c.name}</span>
                </span>
              </th>
              {months.map((m) => (
                <td key={m} className={cell}>
                  {EMPTY}
                </td>
              ))}
              <td className={`${cell} ${stickyEnd} px-3`}>{EMPTY}</td>
            </tr>
          ))}
        </tbody>

        <tfoot className="border-t border-line font-medium">
          <tr>
            <th scope="row" className={`${sticky} px-3 py-3 text-left font-medium`}>
              Total spent
            </th>
            {months.map((m) => (
              <td key={m} className={cell}>
                {money(series.spent[m] ?? 0)}
              </td>
            ))}
            <td className={`${cell} ${stickyEnd} px-3`}>{formatMoneyWhole(spentTotal, currency)}</td>
          </tr>
          <tr>
            <th scope="row" className={`${sticky} px-3 py-2.5 text-left font-normal`}>
              Invested
            </th>
            {months.map((m) => (
              <td key={m} className={`${cell} font-normal`}>
                {money(series.invested[m] ?? 0)}
              </td>
            ))}
            <td className={`${cell} ${stickyEnd} px-3`}>{money(investedTotal)}</td>
          </tr>
          <tr className="text-muted">
            <th scope="row" className={`${sticky} px-3 py-2.5 text-left font-normal`}>
              Income
            </th>
            {months.map((m) => (
              <td key={m} className={cell}>
                {money(series.income[m] ?? 0)}
              </td>
            ))}
            <td className={`${cell} ${stickyEnd} px-3`}>{formatMoneyWhole(incomeTotal, currency)}</td>
          </tr>
          <tr>
            <th scope="row" className={`${sticky} px-3 py-2.5 text-left font-medium`}>
              Net
            </th>
            {netByMonth.map((n, i) => (
              <td key={months[i]} className={`${cell} ${n < 0 ? "text-negative" : n > 0 ? "text-positive" : ""}`}>
                {n === 0 ? EMPTY : `${n < 0 ? "−" : "+"}${formatMoneyWhole(Math.abs(n), currency)}`}
              </td>
            ))}
            <td
              className={`${cell} ${stickyEnd} px-3 ${incomeTotal - spentTotal < 0 ? "text-negative" : "text-positive"}`}
            >
              {`${incomeTotal - spentTotal < 0 ? "−" : "+"}${formatMoneyWhole(Math.abs(incomeTotal - spentTotal), currency)}`}
            </td>
          </tr>
        </tfoot>
      </table>
    </ScrollToEnd>
  );
}
