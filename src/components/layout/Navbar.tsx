"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListOrdered,
  Upload,
  BarChart3,
  RefreshCw,
  Settings,
  Search,
  LogOut,
  Wallet,
  PieChart,
  CheckSquare,
  Shield,
  FlaskConical,
  CreditCard,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { BookSwitcher } from "./BookSwitcher";
import { GuideBell } from "@/components/guide/GuideBell";
import { useGuideContext } from "@/components/providers/GuideProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

/** Primary destinations shown in the mobile bottom bar (keep ≤4). */
const MOBILE_PRIMARY_HREFS = ["/", "/transactions", "/categories", "/debts"] as const;

export function Navbar() {
  const pathname = usePathname();
  const { signOutUser, user, isAdmin } = useAuth();
  const { t } = useLocale();
  const { result } = useGuideContext();
  const navDots = result?.navDots ?? {};
  const [moreOpen, setMoreOpen] = useState(false);

  const NAV_ITEMS = useMemo((): NavItem[] => {
    const items: NavItem[] = [
      { href: "/", label: t.nav_dashboard, icon: LayoutDashboard },
      { href: "/transactions", label: t.nav_transactions, icon: ListOrdered },
      { href: "/statistics", label: t.nav_statistics, icon: PieChart },
      { href: "/import", label: t.nav_import_csv, icon: Upload },
      { href: "/categories", label: t.nav_categories, icon: BarChart3 },
      { href: "/recurring", label: t.nav_recurring, icon: RefreshCw },
      { href: "/debts", label: t.nav_debts, icon: CreditCard },
      { href: "/tasks", label: t.nav_tasks, icon: CheckSquare },
      { href: "/simulation", label: t.nav_simulation, icon: FlaskConical },
      { href: "/settings", label: t.nav_settings, icon: Settings },
    ];
    if (isAdmin) {
      items.push({ href: "/admin", label: t.nav_admin, icon: Shield });
    }
    return items;
  }, [t, isAdmin]);

  const primaryHrefs = useMemo(
    () => new Set<string>(MOBILE_PRIMARY_HREFS),
    []
  );

  const mobilePrimary = useMemo(
    () => NAV_ITEMS.filter((item) => primaryHrefs.has(item.href)),
    [NAV_ITEMS, primaryHrefs]
  );

  const mobileMore = useMemo(
    () => NAV_ITEMS.filter((item) => !primaryHrefs.has(item.href)),
    [NAV_ITEMS, primaryHrefs]
  );

  const moreActive = mobileMore.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  const moreHasDot = mobileMore.some((item) => hasDot(item.href, navDots));

  // Close the sheet when navigating.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    if (!moreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [moreOpen]);

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-2 sm:gap-4 px-3 sm:px-4 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-primary shrink-0"
          >
            <Wallet className="h-5 w-5" />
            <span className="hidden sm:inline">{t.nav_brand}</span>
          </Link>

          <div className="min-w-0 flex-1">
            <BookSwitcher />
          </div>

          <div className="ms-auto flex items-center gap-1 sm:gap-2 shrink-0">
            <GlobalSearchTrigger label={t.nav_search_placeholder} />
            {user && <GuideBell />}
            {user && (
              <Button
                variant="ghost"
                size="icon"
                onClick={signOutUser}
                title={t.nav_sign_out}
                className="hidden sm:inline-flex"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Bottom nav for mobile — primary tabs + More */}
      <nav className="fixed bottom-0 start-0 end-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] sm:hidden">
        <div className="flex h-16 items-stretch justify-around px-1">
          {mobilePrimary.map(({ href, icon: Icon, label }) => (
            <MobileNavLink
              key={href}
              href={href}
              label={label}
              icon={Icon}
              active={pathname === href}
              dotted={hasDot(href, navDots)}
            />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-[10px] leading-tight transition-colors",
              moreActive || moreOpen
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
          >
            <span className="relative">
              <MoreHorizontal className="h-5 w-5" />
              {moreHasDot && (
                <span className="absolute -top-0.5 -end-1 h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </span>
            <span className="max-w-full truncate">{t.nav_more}</span>
          </button>
        </div>
      </nav>

      {/* Mobile "More" sheet */}
      {moreOpen && (
        <div className="sm:hidden" role="dialog" aria-modal="true" aria-label={t.nav_more}>
          <button
            type="button"
            className="fixed inset-0 z-50 bg-black/40"
            aria-label={t.nav_more_close}
            onClick={() => setMoreOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t bg-background shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="sticky top-0 flex items-center justify-between gap-3 border-b bg-background px-4 py-3">
              <p className="text-sm font-semibold">{t.nav_more}</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setMoreOpen(false)}
                aria-label={t.nav_more_close}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-3 pb-6">
              {mobileMore.map(({ href, icon: Icon, label }) => {
                const active =
                  pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "relative flex flex-col items-center justify-center gap-2 rounded-xl border px-2 py-4 text-center transition-colors",
                      active
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:bg-accent"
                    )}
                  >
                    <span className="relative">
                      <Icon className="h-5 w-5" />
                      {hasDot(href, navDots) && (
                        <span className="absolute -top-0.5 -end-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </span>
                    <span className="text-xs font-medium leading-snug line-clamp-2">
                      {label}
                    </span>
                  </Link>
                );
              })}
            </div>
            {user && (
              <div className="border-t px-4 py-3 pb-8">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-muted-foreground"
                  onClick={() => {
                    setMoreOpen(false);
                    void signOutUser();
                  }}
                >
                  <LogOut className="h-4 w-4" /> {t.nav_sign_out}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sidebar-nav fixed inset-y-0 start-0 top-14 z-30 hidden w-56 flex-col border-e bg-background sm:flex">
        <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{label}</span>
              {hasDot(href, navDots) && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              )}
            </Link>
          ))}
        </nav>
        {user && (
          <div className="p-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground truncate mb-2">
              {user.photoURL && (
                <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" />
              )}
              <span className="truncate">{user.displayName ?? user.email}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={signOutUser}
            >
              <LogOut className="h-4 w-4" /> {t.nav_sign_out}
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}

function hasDot(
  href: string,
  navDots: Record<string, boolean | undefined>
): boolean {
  return href === "/categories" ||
    href === "/import" ||
    href === "/recurring" ||
    href === "/tasks"
    ? Boolean(navDots[href])
    : false;
}

function MobileNavLink({
  href,
  label,
  icon: Icon,
  active,
  dotted,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  dotted: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-[10px] leading-tight transition-colors",
        active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span className="relative">
        <Icon className="h-5 w-5" />
        {dotted && (
          <span className="absolute -top-0.5 -end-1 h-1.5 w-1.5 rounded-full bg-primary" />
        )}
      </span>
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}

function GlobalSearchTrigger({ label }: { label: string }) {
  const handleOpen = () => {
    window.dispatchEvent(new CustomEvent("open-global-search"));
  };
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 hidden sm:flex"
      onClick={handleOpen}
    >
      <Search className="h-4 w-4" />
      <span className="text-muted-foreground text-sm">{label}</span>
      <kbd className="text-xs bg-muted px-1.5 py-0.5 rounded hidden lg:inline">
        ⌘K
      </kbd>
    </Button>
  );
}
