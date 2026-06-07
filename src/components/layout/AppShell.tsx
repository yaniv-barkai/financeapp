"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { QuickAddFab } from "@/components/transactions/QuickAddFab";
import { PwaInit } from "@/components/layout/PwaInit";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isImport = pathname === "/import";

  return (
    <div className="min-h-screen">
      <Navbar />
      <GlobalSearch />
      <main className="sm:ps-56 pt-14 pb-20 sm:pb-6 min-h-screen">
        <div
          className={cn(
            "mx-auto p-4 sm:p-6",
            isImport ? "max-w-none w-full" : "max-w-5xl"
          )}
        >
          {children}
        </div>
      </main>
      <QuickAddFab />
      <PwaInit />
    </div>
  );
}
