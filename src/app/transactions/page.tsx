"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Edit, Trash2, ArrowRightLeft, RefreshCw } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { addMonths, addWeeks, addYears } from "date-fns";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useAppStore } from "@/lib/store";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  getTransactionsByMonth,
  deleteTransaction,
  transferTransaction,
  updateTransaction,
} from "@/lib/firestore/transactions";
import { upsertMerchant } from "@/lib/firestore/merchants";
import { addRecurring, skipRecurringPeriod } from "@/lib/firestore/recurring";
import { Transaction, RecurringCadence } from "@/lib/types";
import { formatCurrency, formatDate, getMonthRange, getCategoryDisplayName } from "@/lib/utils";
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

/** Icon + label that open one shared category picker (good tap targets on mobile). */
function TransactionCategoryControls({
  tx,
  catIcon,
  catLabel,
  onChange,
  tagsSlot,
  note,
}: {
  tx: Transaction;
  catIcon: string;
  catLabel: string;
  onChange: (categoryId: string) => void;
  tagsSlot?: React.ReactNode;
  note?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xl w-10 h-10 flex-shrink-0 inline-flex items-center justify-center rounded-md hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={catLabel}
      >
        {catIcon}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {tx.merchantDisplay || catLabel}
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded px-1 py-0.5 -mx-1 min-h-[28px] inline-flex items-center hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {catLabel}
          </button>
          <span>·</span>
          <span>{formatDate(tx.date.toDate())}</span>
          {tx.recurringId && (
            <span className="inline-flex items-center gap-0.5 ms-0.5">
              · <RefreshCw className="h-3 w-3 inline" />
            </span>
          )}
        </p>
        {tagsSlot}
        {note && <p className="text-xs text-muted-foreground italic truncate">{note}</p>}
      </div>
      <CategoryPicker
        value={tx.categoryId}
        onChange={(id) => {
          onChange(id);
          setOpen(false);
        }}
        typeFilter={tx.type}
        open={open}
        onOpenChange={setOpen}
        hideTrigger
      />
    </>
  );
}

export default function TransactionsPage() {
  const { user, loading } = useRequireAuth();
  const { activeBookId, categories, tags, currency, activeMonth, books, txVersion, bumpTxVersion, setMerchants } = useAppStore();
  const { t, locale } = useLocale();

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
  const [convertTx, setConvertTx] = useState<Transaction | null>(null);
  const [convertCadence, setConvertCadence] = useState<RecurringCadence>("monthly");
  const [converting, setConverting] = useState(false);

  const { start, end } = getMonthRange(activeMonth);

  const loadData = async () => {
    if (!user || !activeBookId) return;
    const txs = await getTransactionsByMonth(user.uid, activeBookId, start, end);
    setTransactions(txs);
  };

  useEffect(() => {
    loadData();
  }, [user, activeBookId, activeMonth, txVersion]);

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

  // Only show tags that appear in transactions this month
  const usedTagIds = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((tx) => tx.tags?.forEach((id) => set.add(id)));
    return set;
  }, [transactions]);

  const usedTags = useMemo(
    () => tags.filter((tag) => usedTagIds.has(tag.id)),
    [tags, usedTagIds]
  );

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
    if (tx.recurringId) {
      await skipRecurringPeriod(user.uid, activeBookId, tx.recurringId, end);
    }
    bumpTxVersion();
    loadData();
  };

  const handleCategoryChange = async (tx: Transaction, categoryId: string) => {
    if (!user || !activeBookId || categoryId === tx.categoryId) return;
    setTransactions((prev) =>
      prev.map((t) => (t.id === tx.id ? { ...t, categoryId } : t))
    );
    await updateTransaction(user.uid, activeBookId, tx.id, { categoryId });
    if (tx.merchantDisplay) {
      await upsertMerchant(user.uid, activeBookId, tx.merchantDisplay, categoryId);
      const { getMerchants } = await import("@/lib/firestore/merchants");
      const updated = await getMerchants(user.uid, activeBookId);
      setMerchants(updated);
    }
    bumpTxVersion();
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

  const handleConvertToRecurring = async () => {
    if (!user || !activeBookId || !convertTx) return;
    setConverting(true);
    try {
      const txDate = convertTx.date.toDate();
      let nextRun: Date;
      if (convertCadence === "weekly") nextRun = addWeeks(txDate, 1);
      else if (convertCadence === "yearly") nextRun = addYears(txDate, 1);
      else nextRun = addMonths(txDate, 1);

      await addRecurring(user.uid, activeBookId, {
        type: convertTx.type,
        amount: convertTx.amount,
        categoryId: convertTx.categoryId,
        ...(convertTx.merchantDisplay && { merchantDisplay: convertTx.merchantDisplay }),
        ...(convertTx.note && { note: convertTx.note }),
        cadence: convertCadence,
        nextRunDate: Timestamp.fromDate(nextRun),
        active: true,
      });
      setConvertTx(null);
    } finally {
      setConverting(false);
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
        {usedTags.length > 0 && (
          <Select value={filterTag || "all"} onValueChange={(v) => setFilterTag(v === "all" ? "" : v === filterTag ? "" : v)}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder={t.transactions_all_tags} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.transactions_all_tags}</SelectItem>
              {usedTags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </span>
                </SelectItem>
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
            const txTags = (tx.tags ?? [])
              .map((id) => tags.find((tg) => tg.id === id))
              .filter(Boolean) as typeof tags;
            const catLabel = cat ? getCategoryDisplayName(cat, locale) : "—";
            return (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                <TransactionCategoryControls
                  tx={tx}
                  catIcon={cat?.icon ?? "📦"}
                  catLabel={catLabel}
                  onChange={(id) => handleCategoryChange(tx, id)}
                  note={tx.note}
                  tagsSlot={
                    txTags.length > 0 ? (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {txTags.map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="outline"
                            className="text-xs py-0 h-5 gap-1"
                            style={{ borderColor: tag.color + "55", color: tag.color, backgroundColor: tag.color + "11" }}
                          >
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    ) : undefined
                  }
                />
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
                    <DropdownMenuItem onClick={() => { setConvertTx(tx); setConvertCadence("monthly"); }}>
                      <RefreshCw className="h-4 w-4 me-2" /> {t.transactions_convert_to_recurring}
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

      {/* Convert to recurring dialog */}
      <Dialog open={!!convertTx} onOpenChange={(o) => !o && setConvertTx(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.transactions_recurring_dialog_title}</DialogTitle>
          </DialogHeader>
          {convertTx && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm space-y-1">
                <p className="font-medium">{convertTx.merchantDisplay || categories.find((c) => c.id === convertTx.categoryId)?.name}</p>
                <p className="text-muted-foreground">
                  {formatCurrency(convertTx.amount, currency)} · {categories.find((c) => c.id === convertTx.categoryId)?.name}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium">{t.transactions_recurring_cadence}</p>
                <Select value={convertCadence} onValueChange={(v) => setConvertCadence(v as RecurringCadence)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">{t.recurring_weekly}</SelectItem>
                    <SelectItem value="monthly">{t.recurring_monthly}</SelectItem>
                    <SelectItem value="yearly">{t.recurring_yearly}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConvertTx(null)}>{t.transactions_cancel}</Button>
                <Button className="flex-1" onClick={handleConvertToRecurring} disabled={converting}>
                  {converting ? t.transactions_recurring_converting : t.transactions_recurring_convert}
                </Button>
              </div>
            </div>
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
