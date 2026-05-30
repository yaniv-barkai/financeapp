"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Edit, Trash2, ArrowRightLeft, Tag } from "lucide-react";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useAppStore } from "@/lib/store";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  getTransactionsByMonth,
  deleteTransaction,
  transferTransaction,
} from "@/lib/firestore/transactions";
import { Transaction } from "@/lib/types";
import { formatCurrency, formatDate, getMonthRange } from "@/lib/utils";
import { MonthSwitcher } from "@/components/dashboard/MonthSwitcher";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { CategoryPicker } from "@/components/transactions/CategoryPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/providers/ConfirmProvider";

export default function TransactionsPage() {
  const { user, loading } = useRequireAuth();
  const { activeBookId, categories, currency, activeMonth, books } = useAppStore();
  const { t } = useLocale();

  const confirm = useConfirm();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [filterCat, setFilterCat] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [filterTag, setFilterTag] = useState("");
  const [searchText, setSearchText] = useState("");
  const [transferTx, setTransferTx] = useState<Transaction | null>(null);
  const [transferBookId, setTransferBookId] = useState("");
  const [transferring, setTransferring] = useState(false);

  const { start, end } = getMonthRange(activeMonth);

  const loadData = async () => {
    if (!user || !activeBookId) return;
    const txs = await getTransactionsByMonth(user.uid, activeBookId, start, end);
    setTransactions(txs);
  };

  useEffect(() => {
    loadData();
  }, [user, activeBookId, activeMonth]);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterCat && tx.categoryId !== filterCat) return false;
      if (filterType !== "all" && tx.type !== filterType) return false;
      if (filterTag && !tx.tags?.includes(filterTag)) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        if (
          !tx.merchantDisplay?.toLowerCase().includes(q) &&
          !tx.note?.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [transactions, filterCat, filterType, filterTag, searchText]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((tx) => tx.tags?.forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [transactions]);

  const handleDelete = async (tx: Transaction) => {
    if (!user || !activeBookId) return;
    const ok = await confirm({
      title: "Delete transaction?",
      message: t.transactions_delete_confirm,
      confirmLabel: "Delete",
      cancelLabel: t.transactions_cancel,
    });
    if (!ok) return;
    await deleteTransaction(user.uid, activeBookId, tx.id);
    loadData();
  };

  const handleTransfer = async () => {
    if (!user || !activeBookId || !transferTx || !transferBookId) return;
    setTransferring(true);
    try {
      await transferTransaction(user.uid, activeBookId, transferBookId, transferTx);
      setTransferTx(null);
      loadData();
    } finally {
      setTransferring(false);
    }
  };

  const otherBooks = books.filter((b) => b.id !== activeBookId);

  if (loading) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.transactions_title}</h1>
        <MonthSwitcher />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder={t.transactions_search_placeholder}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="h-9 w-40"
        />
        <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.transactions_all_types}</SelectItem>
            <SelectItem value="expense">{t.transactions_expense}</SelectItem>
            <SelectItem value="income">{t.transactions_income}</SelectItem>
          </SelectContent>
        </Select>
        <div className="w-44">
          <CategoryPicker
            value={filterCat}
            onChange={(v) => setFilterCat(v === filterCat ? "" : v)}
            placeholder={t.transactions_all_categories}
          />
        </div>
        {allTags.length > 0 && (
          <Select value={filterTag} onValueChange={(v) => setFilterTag(v === filterTag ? "" : v)}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder={t.transactions_all_tags} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t.transactions_all_tags}</SelectItem>
              {allTags.map((tag) => (
                <SelectItem key={tag} value={tag}>#{tag}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {(filterCat || filterType !== "all" || filterTag || searchText) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterCat(""); setFilterType("all"); setFilterTag(""); setSearchText(""); }}>
            {t.transactions_clear}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-10">
              {t.transactions_no_results}
            </p>
          )}
          {filtered.map((tx) => {
            const cat = categories.find((c) => c.id === tx.categoryId);
            return (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl w-8 text-center flex-shrink-0">{cat?.icon ?? "📦"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {tx.merchantDisplay || cat?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cat?.name} · {formatDate(tx.date.toDate())}
                  </p>
                  {tx.tags?.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {tx.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs py-0 h-5 gap-1">
                          <Tag className="h-2.5 w-2.5" />#{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {tx.note && <p className="text-xs text-muted-foreground italic truncate">{tx.note}</p>}
                </div>
                <span className={`font-semibold text-sm flex-shrink-0 ${tx.type === "income" ? "text-green-600" : "text-red-500"}`}>
                  {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount, currency)}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditTx(tx)}>
                      <Edit className="h-4 w-4 me-2" /> {t.transactions_edit}
                    </DropdownMenuItem>
                    {otherBooks.length > 0 && (
                      <DropdownMenuItem onClick={() => { setTransferTx(tx); setTransferBookId(otherBooks[0].id); }}>
                        <ArrowRightLeft className="h-4 w-4 me-2" /> {t.transactions_move_to_book}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDelete(tx)}
                    >
                      <Trash2 className="h-4 w-4 me-2" /> {t.transactions_delete}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editTx} onOpenChange={(o) => !o && setEditTx(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.transactions_edit_dialog_title}</DialogTitle>
          </DialogHeader>
          {editTx && (
            <TransactionForm
              existing={editTx}
              onDone={() => { setEditTx(null); loadData(); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer dialog */}
      <Dialog open={!!transferTx} onOpenChange={(o) => !o && setTransferTx(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.transactions_move_dialog_title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={transferBookId} onValueChange={setTransferBookId}>
              <SelectTrigger>
                <SelectValue placeholder={t.transactions_select_book} />
              </SelectTrigger>
              <SelectContent>
                {otherBooks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setTransferTx(null)}>{t.transactions_cancel}</Button>
              <Button className="flex-1" onClick={handleTransfer} disabled={transferring}>
                {transferring ? t.transactions_moving : t.transactions_move}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
