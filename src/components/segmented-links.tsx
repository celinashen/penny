import Link from "next/link";

/** A pill toggle made of links, so each choice is a shareable URL. */
export function SegmentedLinks<T extends string>({
  options,
  current,
  hrefFor,
  label,
}: {
  options: { value: T; label: string }[];
  current: T;
  hrefFor: (value: T) => string;
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-full border border-line bg-raised p-1"
    >
      {options.map((o) => (
        <Link
          key={o.value}
          href={hrefFor(o.value)}
          aria-current={o.value === current ? "true" : undefined}
          className={`rounded-full px-4 py-1 text-center text-sm font-medium transition-colors ${
            o.value === current ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
