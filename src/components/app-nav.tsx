"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

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
    href: "/trips",
    label: "Trips",
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M3 12h18" />
      </svg>
    ),
  },
  {
    href: "/year",
    label: "Year",
    icon: (
      <svg {...iconProps}>
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
        <path d="M8 14h2M12 14h2M16 14h.01M8 17h2M12 17h2" />
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

/** Menu button and drop-down sheet for phones. */
export function MobileMenu({ children }: { children: ReactNode }) {
  const isActive = useIsActive();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close once the new page is showing.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
        className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-foreground transition-colors hover:bg-raised"
      >
        <svg {...iconProps}>
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-foreground/20" />
          <div
            id="mobile-menu"
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-3 top-[calc(4.25rem+env(safe-area-inset-top))] flex flex-col gap-3 rounded-3xl border border-line bg-surface p-2 shadow-[0_8px_30px_-8px_rgba(14,21,18,0.25)]"
          >
            <nav aria-label="Main" className="flex flex-col gap-1">
              {ITEMS.map(({ href, label, icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-base font-medium transition-colors ${
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
            <div className="border-t border-line px-4 pb-2 pt-4">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
