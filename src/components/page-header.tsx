export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-8 lg:mb-10">
      {eyebrow && (
        <p className="mb-2 font-mono text-xs uppercase tracking-wider text-muted">
          {eyebrow}
        </p>
      )}
      <h1 className="text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
        {title}
      </h1>
      {description && (
        <p className="mt-3 max-w-prose text-muted">{description}</p>
      )}
    </header>
  );
}
