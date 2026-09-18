import type { ReactNode } from "react";

/** A headline number: label, big value, and an optional line beneath it. */
export function Stat({
  label,
  value,
  tone = "",
  children,
}: {
  label: string;
  value: string;
  tone?: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <p className="text-sm text-muted">{label}</p>
      {/* Proportional figures on the big number; tabular ones are for columns. */}
      <p className={`mt-1.5 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl ${tone}`}>{value}</p>
      {children && <div className="mt-1.5 min-h-5">{children}</div>}
    </div>
  );
}
