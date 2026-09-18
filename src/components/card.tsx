import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(14,21,18,0.04),0_8px_24px_-12px_rgba(14,21,18,0.08)] sm:p-7 ${className}`}
    >
      <h2 className="text-xl font-semibold tracking-[-0.02em]">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      {/* A container query root: charts inside adapt to the card's width, not the screen's. */}
      <div className="@container mt-5">{children}</div>
    </section>
  );
}
