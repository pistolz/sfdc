"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { AccountView } from "@/lib/types";
import { BRAND } from "@/lib/brand";
import { Wordmark } from "./logo";
import { CreditMeter } from "./credit-meter";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { buttonClasses, cn } from "./ui/styles";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

function Icon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-[18px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

const NAV: NavItem[] = [
  {
    href: "/app",
    label: "Dashboard",
    icon: <Icon path="M4 13h7V4H4v9Zm0 7h7v-5H4v5Zm9 0h7v-9h-7v9Zm0-16v5h7V4h-7Z" />,
  },
  {
    href: "/app/assets",
    label: "Assets",
    icon: (
      <Icon path="M6 3h8l5 5v13H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm8 0v5h5M9 13h7M9 17h5" />
    ),
  },
  {
    href: "/app/brand",
    label: "Brand kits",
    icon: <Icon path="M12 3l2.6 5.5 6 .9-4.3 4.3 1 6.1-5.3-2.9-5.3 2.9 1-6.1L3.4 9.4l6-.9L12 3Z" />,
  },
  {
    href: "/app/billing",
    label: "Billing",
    icon: <Icon path="M3 7.5h18M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-9Zm4 7h4" />,
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(account: AccountView): string {
  const source = account.displayName || account.email || "?";
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-1">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-soft text-accent-text"
                  : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AppShell({
  account,
  children,
}: {
  account: AccountView;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function signOut() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      const response = await fetch("/api/auth/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Sign out failed");
      router.push("/");
      router.refresh();
    } catch {
      setSignOutError("Could not sign out. Please try again.");
      setSigningOut(false);
    }
  }

  const sidebarFooter = (
    <div className="space-y-4">
      <CreditMeter account={account} />
      {account.credits <= 0 ? (
        <Link
          href="/app/billing"
          className={buttonClasses("primary", "sm", "w-full")}
        >
          Get more credits
        </Link>
      ) : null}
      <div className="flex items-center gap-3 border-t border-border pt-4">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[12px] font-semibold"
        >
          {initials(account)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">
            {account.displayName || account.email}
          </p>
          <p className="truncate text-[12px] text-faint">{account.email}</p>
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        onClick={signOut}
        loading={signingOut}
      >
        Sign out
      </Button>
      {signOutError ? (
        <p role="alert" className="text-[12px] text-danger">
          {signOutError}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Desktop sidebar ------------------------------------------------- */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface px-4 py-5 lg:flex">
        <div className="flex items-center justify-between gap-2 px-1">
          <Wordmark href="/app" />
          <Badge tone={account.plan === "free" ? "neutral" : "accent"}>
            {account.planName}
          </Badge>
        </div>
        <nav aria-label="Studio" className="mt-8 flex-1">
          <NavLinks pathname={pathname} />
        </nav>
        {sidebarFooter}
      </aside>

      {/* Mobile header ---------------------------------------------------- */}
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <Wordmark href="/app" />
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-faint tabular-nums">
                {account.credits.toLocaleString("en-US")} cr
              </span>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-controls="app-mobile-nav"
                className="flex size-9 items-center justify-center rounded-lg border border-border-strong bg-surface"
              >
                <span className="sr-only">
                  {menuOpen ? "Close menu" : "Open menu"}
                </span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  {menuOpen ? (
                    <path d="M6 6l12 12M18 6L6 18" />
                  ) : (
                    <path d="M4 7h16M4 12h16M4 17h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
          <div
            id="app-mobile-nav"
            hidden={!menuOpen}
            className="border-t border-border bg-surface px-4 py-4"
          >
            <nav aria-label="Studio">
              <NavLinks
                pathname={pathname}
                onNavigate={() => setMenuOpen(false)}
              />
            </nav>
            <div className="mt-4">{sidebarFooter}</div>
          </div>
        </header>

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>

        <footer className="border-t border-border px-5 py-5 text-[12px] text-faint lg:px-8">
          {BRAND.name} · Need a hand?{" "}
          <a
            href={`mailto:${BRAND.supportEmail}`}
            className="rounded underline underline-offset-2 hover:text-fg"
          >
            {BRAND.supportEmail}
          </a>
        </footer>
      </div>
    </div>
  );
}
