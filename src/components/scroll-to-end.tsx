"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A horizontally scrolling box that starts at its right edge. For tables of
 * months that keeps the newest ones in view, with older ones a swipe away.
 */
export function ScrollToEnd({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
