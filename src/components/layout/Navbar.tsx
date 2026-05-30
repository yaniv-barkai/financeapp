"use client";

import React from "react";
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
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { BookSwitcher } from "./BookSwitcher";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const { signOutUser, user } = useAuth();
  const { t } = useLocale();

  const NAV_ITEMS = [
    { href: "/", label: t.nav_dashboard, icon: LayoutDashboard },
    { href: "/transactions", label: t.nav_transactions, icon: ListOrdered },
    { href: "/import", label: t.nav_import_csv, icon: Upload },
    { href: "/categories", label: t.nav_categories, icon: BarChart3 },
    { href: "/recurring", label: t.nav_recurring, icon: RefreshCw },
    { href: "/settings", label: t.nav_settings, icon: Settings },
  ];

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-primary me-2">
            <Wallet className="h-5 w-5" />
            <span className="hidden sm:inline">{t.nav_brand}</span>
          </Link>

          <BookSwitcher />

          <div className="ms-auto flex items-center gap-2">
            <GlobalSearchTrigger label={t.nav_search_placeholder} />
            {user && (
              <Button variant="ghost" size="icon" onClick={signOutUser} title={t.nav_sign_out}>
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Bottom nav for mobile — CSV import is desktop-only */}
      <nav className="fixed bottom-0 start-0 end-0 z-40 border-t bg-background sm:hidden">
        <div className="flex h-16 items-center justify-around">
          {NAV_ITEMS.filter((item) => item.href !== "/import").map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-1 text-[10px] transition-colors",
                pathname === href
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Desktop sidebar */}
      <aside className="sidebar-nav fixed inset-y-0 start-0 top-14 z-30 hidden w-56 flex-col border-e bg-background sm:flex">
        <nav className="flex-1 space-y-1 p-4">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
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
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={signOutUser}>
              <LogOut className="h-4 w-4" /> {t.nav_sign_out}
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}

function GlobalSearchTrigger({ label }: { label: string }) {
  const handleOpen = () => {
    window.dispatchEvent(new CustomEvent("open-global-search"));
  };
  return (
    <Button variant="outline" size="sm" className="gap-2 hidden sm:flex" onClick={handleOpen}>
      <Search className="h-4 w-4" />
      <span className="text-muted-foreground text-sm">{label}</span>
      <kbd className="text-xs bg-muted px-1.5 py-0.5 rounded hidden lg:inline">⌘K</kbd>
    </Button>
  );
}
