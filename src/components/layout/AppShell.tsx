"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { QuickAddFab } from "@/components/transactions/QuickAddFab";
import { PwaInit } from "@/components/layout/PwaInit";
import { GuideProvider } from "@/components/providers/GuideProvider";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  const isImport = pathname === "/import";
  const isAdmin = pathname === "/admin";

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <GuideProvider>
      <div className="min-h-screen overflow-x-hidden">
        <Navbar />
        <GlobalSearch />
        <main className="sm:ps-56 pt-14 pb-20 sm:pb-6 min-h-screen overflow-x-hidden">
          <div
            className={cn(
              "mx-auto p-3 sm:p-6 min-w-0",
              isImport || isAdmin ? "max-w-none w-full" : "max-w-5xl"
            )}
          >
            {children}
          </div>
        </main>
        {!isAdmin && <QuickAddFab />}
        <PwaInit />
      </div>
    </GuideProvider>
  );
}
