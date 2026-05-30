"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DollarSign } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAppStore } from "@/lib/store";
import { useLocale } from "@/components/providers/LocaleProvider";
import { getAllTransactions } from "@/lib/firestore/transactions";
import { Transaction } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [query, setQuery] = useState("");
  const { user } = useAuth();
  const { activeBookId, categories, currency } = useAppStore();
  const { t } = useLocale();
  const router = useRouter();

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-global-search", handler);
    return () => window.removeEventListener("open-global-search", handler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || !user || !activeBookId) return;
    getAllTransactions(user.uid, activeBookId).then(setTransactions);
  }, [open, user, activeBookId]);

  const filtered = query.trim()
    ? transactions.filter((t) => {
        const q = query.toLowerCase();
        return (
          t.merchantDisplay?.toLowerCase().includes(q) ||
          t.note?.toLowerCase().includes(q) ||
          String(t.amount).includes(q) ||
          t.tags?.some((tag) => tag.includes(q))
        );
      }).slice(0, 20)
    : transactions.slice(0, 10);

  const getCatName = (catId: string) =>
    categories.find((c) => c.id === catId)?.name ?? catId;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder={t.search_placeholder}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{t.search_no_results}</CommandEmpty>
        <CommandGroup heading={t.search_group_heading}>
          {filtered.map((tx) => (
            <CommandItem
              key={tx.id}
              value={`${tx.merchantDisplay ?? ""} ${tx.note ?? ""} ${tx.amount}`}
              onSelect={() => {
                router.push(`/transactions?highlight=${tx.id}`);
                setOpen(false);
              }}
              className="gap-3"
            >
              <DollarSign
                className="h-4 w-4 flex-shrink-0"
                style={{ color: tx.type === "income" ? "#22c55e" : "#ef4444" }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {tx.merchantDisplay || getCatName(tx.categoryId)}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {getCatName(tx.categoryId)} · {formatDate(tx.date.toDate())}
                </p>
              </div>
              <span
                className={`font-mono text-sm font-semibold flex-shrink-0 ${tx.type === "income" ? "text-green-600" : "text-red-500"}`}
              >
                {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount, currency)}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
