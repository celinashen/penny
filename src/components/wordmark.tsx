export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 font-semibold tracking-[-0.04em] ${className}`}
    >
      <span
        aria-hidden
        className="grid h-[1.15em] w-[1.15em] place-items-center rounded-[0.36em] bg-foreground"
      >
        <span className="h-[0.46em] w-[0.46em] rounded-full bg-mint" />
      </span>
      Penny
    </span>
  );
}
