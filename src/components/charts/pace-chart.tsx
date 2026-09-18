"use client";

import { useEffect, useRef, useState } from "react";
import type { Currency } from "@/lib/accounts";
import { formatMoney } from "@/lib/transactions";
import { niceCeil } from "./nice";

const HEIGHT = 250;
const M = { top: 20, right: 16, bottom: 30, left: 50 };

const compact = (n: number, currency: Currency) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);

/**
 * Month-to-date spending as a running total, continued as a dashed projection to
 * the end of the month, against your typical month. One series (solid so far,
 * dashed where it's a forecast) plus a quiet reference line.
 */
export function PaceChart({
  daysInMonth,
  cumulative,
  projected,
  average,
  currency,
  monthLabel,
}: {
  daysInMonth: number;
  /** Running total for day 1..today. */
  cumulative: number[];
  projected: number;
  /** A typical full month, or null when there isn't enough history for one. */
  average: number | null;
  currency: Currency;
  monthLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(el);
    setWidth(Math.max(280, el.clientWidth));
    return () => observer.disconnect();
  }, []);

  const today = cumulative.length;
  const soFar = cumulative[today - 1] ?? 0;
  const top = niceCeil(Math.max(projected, average ?? 0, soFar, 1) * 1.05);
  const plotW = width - M.left - M.right;
  const plotH = HEIGHT - M.top - M.bottom;
  const x = (day: number) => M.left + ((day - 1) / Math.max(1, daysInMonth - 1)) * plotW;
  const y = (value: number) => M.top + plotH - (value / top) * plotH;

  const actual = cumulative.map((v, i) => `${x(i + 1)},${y(v)}`).join(" ");
  const forecastLeft = today < daysInMonth;
  const ticks = [top, top / 2, 0];
  const dayTicks = [1, 8, 15, 22, daysInMonth].filter((d, i, all) => all.indexOf(d) === i && d <= daysInMonth);
  const hitW = Math.max(6, plotW / daysInMonth);

  return (
    <figure ref={ref} aria-label={`Spending pace for ${monthLabel}`}>
      <svg width={width} height={HEIGHT} role="img" className="block overflow-visible">
        <title>{`Spending so far in ${monthLabel} and projected month end`}</title>

        {/* Hairline gridlines; the bottom one is the baseline. */}
        {ticks.map((t, i) => (
          <g key={t}>
            <line
              x1={M.left}
              x2={width - M.right}
              y1={y(t)}
              y2={y(t)}
              stroke={i === ticks.length - 1 ? "#c3c2b7" : "var(--color-line)"}
              strokeWidth="1"
            />
            <text x={M.left - 8} y={y(t) + 4} textAnchor="end" className="fill-muted font-mono text-[10px]">
              {compact(t, currency)}
            </text>
          </g>
        ))}
        {dayTicks.map((d) => (
          <text key={d} x={x(d)} y={HEIGHT - 8} textAnchor="middle" className="fill-muted font-mono text-[10px]">
            {d}
          </text>
        ))}

        {/* Your typical month: a quiet reference line. */}
        {average !== null && average > 0 && (
          <g>
            <line
              x1={M.left}
              x2={width - M.right}
              y1={y(average)}
              y2={y(average)}
              stroke="#898781"
              strokeWidth="1.5"
            />
            <text x={M.left + 6} y={y(average) - 6} className="fill-muted text-[11px]">
              Typical month {formatMoney(average, currency)}
            </text>
          </g>
        )}

        {/* The forecast: from today to month end. */}
        {forecastLeft && (
          <g>
            <line
              x1={x(today)}
              y1={y(soFar)}
              x2={x(daysInMonth)}
              y2={y(projected)}
              stroke="var(--color-accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="2 6"
            />
            <circle cx={x(daysInMonth)} cy={y(projected)} r="5" fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth="2" />
            <text
              x={x(daysInMonth) - 10}
              y={y(projected) - 12}
              textAnchor="end"
              className="fill-foreground text-[11px] font-medium"
            >
              Projected {formatMoney(projected, currency)}
            </text>
          </g>
        )}

        {/* What's actually been spent. */}
        <polyline
          points={actual}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={x(today)} cy={y(soFar)} r="5" fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="2" />

        {/* A tall hit target for every day, so hovering anywhere near reads that day. */}
        {cumulative.map((v, i) => (
          <rect key={i} x={x(i + 1) - hitW / 2} y={M.top} width={hitW} height={plotH} fill="transparent">
            <title>{`${monthLabel.split(" ")[0]} ${i + 1}: ${formatMoney(v, currency)} spent so far`}</title>
          </rect>
        ))}
      </svg>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block h-0.5 w-5 rounded bg-accent" />
          Spent so far
        </span>
        {forecastLeft && (
          <span className="inline-flex items-center gap-2">
            <svg aria-hidden width="20" height="4">
              <line x1="1" y1="2" x2="19" y2="2" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 5" />
            </svg>
            Projected
          </span>
        )}
        {average !== null && average > 0 && (
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="inline-block h-0.5 w-5 rounded bg-[#898781]" />
            Typical month
          </span>
        )}
      </figcaption>
    </figure>
  );
}
