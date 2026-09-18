"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Item = { href: string; label: string; icon: ReactNode };

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: "h-5 w-5",
};

const ITEMS: Item[] = [
  {
    href: "/",
    label: "Overview",
    icon: (
      <svg {...iconProps}>
        <path d="M12 3a9 9 0 1 0 9 9h-9V3Z" />
        <path d="M15.5 3.6A9 9 0 0 1 20.4 8.5H15.5V3.6Z" />
      </svg>
    ),
  },
  {
    href: "/transactions",
    label: "Transactions",
    icon: (
      <svg {...iconProps}>
        <path d="M8 6h12M8 12h12M8 18h12" />
        <circle cx="4" cy="6" r="0.75" />
        <circle cx="4" cy="12" r="0.75" />
        <circle cx="4" cy="18" r="0.75" />
      </svg>
    ),
  },
  {
    href: "/investments",
    label: "Investments",
    icon: (
      <svg {...iconProps}>
        <path d="M3 17l5.5-5.5 4 4L21 7" />
        <path d="M15 7h6v6" />
      </svg>
    ),
  },
  {
    href: "/accounts",
    label: "Accounts",
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="5.5" width="18" height="13" rx="2" />
        <path d="M3 10h18" />
        <path d="M7 15h3" />
      </svg>
    ),
  },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Vertical navigation for wide screens. */
export function SidebarNav() {
  const isActive = useIsActive();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {ITEMS.map(({ href, label, icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9375rem] font-medium transition-colors ${
              active
                ? "bg-raised text-foreground [&>svg]:text-accent"
                : "text-muted hover:bg-raised/60 hover:text-foreground"
            }`}
          >
            {icon}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Fixed bottom bar for phones. */
export function TabBar() {
  const isActive = useIsActive();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 mx-auto max-w-md rounded-3xl border border-line bg-surface/80 p-1.5 shadow-[0_8px_30px_-8px_rgba(14,21,18,0.18)] backdrop-blur-xl lg:hidden"
    >
      <ul className="grid grid-cols-4 gap-1">
        {ITEMS.map(({ href, label, icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[0.6875rem] font-medium transition-colors ${
                  active
                    ? "bg-raised text-foreground [&>svg]:text-accent"
                    : "text-muted"
                }`}
              >
                {icon}
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
