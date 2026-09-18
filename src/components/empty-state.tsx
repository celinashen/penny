import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col items-center gap-2 rounded-3xl border border-line bg-surface px-6 py-14 text-center shadow-[0_1px_2px_rgba(14,21,18,0.04),0_8px_24px_-12px_rgba(14,21,18,0.08)]">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-raised">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground">
          <span className="h-3 w-3 rounded-full bg-mint" />
        </span>
      </div>
      <h2 className="text-xl font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="max-w-sm text-muted">{description}</p>
      {children}
    </section>
  );
}
