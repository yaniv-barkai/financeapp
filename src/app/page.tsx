"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  TrendingUp, TrendingDown, Wallet, Edit, Trash2, RefreshCw, GripVertical,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useAppStore } from "@/lib/store";
import { useLocale } from "@/components/providers/LocaleProvider";
import { getTransactionsByMonth, deleteTransaction, addTransaction } from "@/lib/firestore/transactions";
import { getAllLimits, updateCategoryOrders } from "@/lib/firestore/categories";
import { getRecurring, reconcileRecurring } from "@/lib/firestore/recurring";
import { Transaction, Recurring } from "@/lib/types";
import { formatCurrency, formatDate, getMonthRange } from "@/lib/utils";
import { MonthSwitcher } from "@/components/dashboard/MonthSwitcher";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

// ─── Sortable category row ────────────────────────────────────────────────────

interface SortableCategoryRowProps {
  id: string;
  isReordering: boolean;
  children: React.ReactNode;
}

function SortableCategoryRow({ id, isReordering, children }: SortableCategoryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center">
      {isReordering && (
        <div
          {...attributes}
          {...listeners}
          className="pl-3 pr-1 py-3 flex items-center cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/60" />
        </div>
      )}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading } = useRequireAuth();
  const { activeBookId, categories, setCategories, tags, currency, activeMonth, txVersion } = useAppStore();
  const { t } = useLocale();
  const confirm = useConfirm();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [recurrings, setRecurrings] = useState<Recurring[]>([]);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [overrideAmounts, setOverrideAmounts] = useState<Record<string, number>>({});
  const [isReordering, setIsReordering] = useState(false);

  const { start, end } = getMonthRange(activeMonth);

  const loadData = async () => {
    if (!user || !activeBookId) return;
    setDataLoading(true);
    try {
      await reconcileRecurring(user.uid, activeBookId);
      const [txs, lims, recs] = await Promise.all([
        getTransactionsByMonth(user.uid, activeBookId, start, end),
        getAllLimits(user.uid, activeBookId, categories),
        getRecurring(user.uid, activeBookId),
      ]);
      setTransactions(txs);
      setLimits(lims);
      setRecurrings(recs.filter((r) => r.active));
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, activeBookId, activeMonth, categories.length, txVersion]);

  const bookedRecurringIds = useMemo(
    () => new Set(transactions.filter((tx) => tx.recurringId).map((tx) => tx.recurringId!)),
    [transactions]
  );

  const totalIncome = useMemo(
    () => transactions.filter((tx) => tx.type === "income").reduce((s, tx) => s + tx.amount, 0),
    [transactions]
  );
  const totalExpenses = useMemo(
    () => transactions.filter((tx) => tx.type === "expense").reduce((s, tx) => s + tx.amount, 0),
    [transactions]
  );

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter((tx) => tx.type === "expense").forEach((tx) => {
      map[tx.categoryId] = (map[tx.categoryId] ?? 0) + tx.amount;
    });
    return Object.entries(map).map(([catId, amount]) => {
      const cat = categories.find((c) => c.id === catId);
      return { name: cat?.name ?? catId, amount, color: cat?.color ?? "#6b7280", catId };
    });
  }, [transactions, categories]);

  // Rows sorted by user-defined order (for reorder mode)
  const categoryRowsByOrder = useMemo(() => {
    return categories
      .filter((c) => c.type === "expense")
      .sort((a, b) => a.order - b.order)
      .map((cat) => {
        const spent = expenseByCategory.find((e) => e.catId === cat.id)?.amount ?? 0;
        const limit = limits[cat.id];
        const hasLimit = limit !== undefined && limit > 0;
        const pct = hasLimit ? (spent / limit) * 100 : null;
        return { catId: cat.id, name: cat.name, icon: cat.icon, color: cat.color, spent, limit, hasLimit, pct };
      });
  }, [categories, expenseByCategory, limits]);

  // Rows sorted by budget usage (for normal view)
  const categoryBudgetRows = useMemo(() => {
    return [...categoryRowsByOrder].sort((a, b) => {
      const aOver = a.pct !== null && a.pct >= 100 ? 1 : 0;
      const bOver = b.pct !== null && b.pct >= 100 ? 1 : 0;
      if (aOver !== bOver) return bOver - aOver;
      if (a.pct !== null && b.pct !== null) return b.pct - a.pct;
      if (a.pct !== null) return -1;
      if (b.pct !== null) return 1;
      return b.spent - a.spent;
    });
  }, [categoryRowsByOrder]);

  const displayedCatRows = isReordering ? categoryRowsByOrder : categoryBudgetRows;

  // dnd-kit: PointerSensor for desktop, TouchSensor (long-press) for mobile
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 10 } })
  );

  const handleCategoryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !user || !activeBookId) return;

    const ids = categoryRowsByOrder.map((r) => r.catId);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    const reordered = arrayMove(ids, oldIdx, newIdx);

    // Optimistically update store
    const updatedCats = categories.map((c) => {
      const newOrder = reordered.indexOf(c.id);
      return newOrder >= 0 ? { ...c, order: newOrder } : c;
    });
    setCategories(updatedCats);

    // Persist to Firestore
    await updateCategoryOrders(user.uid, activeBookId, reordered);
  };

  const handleDelete = async (tx: Transaction) => {
    if (!user || !activeBookId) return;
    const ok = await confirm({
      title: "Delete transaction?",
      message: t.dashboard_delete_confirm,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!ok) return;
    await deleteTransaction(user.uid, activeBookId, tx.id);
    loadData();
  };

  const handleRecurringCheck = async (r: Recurring, checked: boolean) => {
    if (!user || !activeBookId) return;
    if (checked) {
      const amount = overrideAmounts[r.id] ?? r.amount;
      await addTransaction(user.uid, activeBookId, {
        type: r.type,
        amount,
        categoryId: r.categoryId,
        merchantDisplay: r.merchantDisplay,
        date: Timestamp.fromDate(new Date()),
        note: r.note,
        tags: [],
        recurringId: r.id,
      });
      loadData();
    } else {
      const tx = transactions.find((tx) => tx.recurringId === r.id);
      if (tx) {
        const uncheck = await confirm({
          title: "Remove booking?",
          message: t.dashboard_recurring_uncheck_confirm,
          confirmLabel: "Remove",
          cancelLabel: "Cancel",
        });
        if (!uncheck) return;
        await deleteTransaction(user.uid, activeBookId, tx.id);
        loadData();
      }
    }
  };

  const cadenceLabel = (cadence: Recurring["cadence"]) => {
    if (cadence === "weekly") return t.recurring_weekly;
    if (cadence === "monthly") return t.recurring_monthly;
    return t.recurring_yearly;
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">{t.dashboard_title}</h1>
        <MonthSwitcher />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center gap-1 sm:gap-2 text-muted-foreground text-xs sm:text-sm mb-1 truncate">
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
              <span className="truncate">{t.dashboard_income}</span>
            </div>
            <p className="text-sm sm:text-xl lg:text-2xl font-bold text-green-600 tabular-nums break-all">
              {formatCurrency(totalIncome, currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center gap-1 sm:gap-2 text-muted-foreground text-xs sm:text-sm mb-1 truncate">
              <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500 flex-shrink-0" />
              <span className="truncate">{t.dashboard_expenses}</span>
            </div>
            <p className="text-sm sm:text-xl lg:text-2xl font-bold text-red-500 tabular-nums break-all">
              {formatCurrency(totalExpenses, currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center gap-1 sm:gap-2 text-muted-foreground text-xs sm:text-sm mb-1 truncate">
              <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="truncate">{t.dashboard_net}</span>
            </div>
            <p
              className={`text-sm sm:text-xl lg:text-2xl font-bold tabular-nums break-all ${
                totalIncome - totalExpenses >= 0 ? "text-green-600" : "text-red-500"
              }`}
            >
              {formatCurrency(totalIncome - totalExpenses, currency)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category spending — all expense categories */}
      {displayedCatRows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">{t.dashboard_monthly_limits}</CardTitle>
              {/* Desktop reorder toggle */}
              <Button
                variant={isReordering ? "default" : "ghost"}
                size="sm"
                className="hidden sm:flex h-7 px-2.5 gap-1.5 text-xs"
                onClick={() => setIsReordering((v) => !v)}
              >
                <GripVertical className="h-3.5 w-3.5" />
                {isReordering ? "Done" : "Reorder"}
              </Button>
              {/* Mobile done button — shown only when reordering */}
              {isReordering && (
                <Button
                  variant="default"
                  size="sm"
                  className="sm:hidden h-7 px-2.5 text-xs"
                  onClick={() => setIsReordering(false)}
                >
                  Done
                </Button>
              )}
            </div>
            {isReordering && (
              <p className="text-xs text-muted-foreground mt-0.5 sm:hidden">
                Long-press a row and drag to reorder
              </p>
            )}
          </CardHeader>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleCategoryDragEnd}
            onDragStart={() => setIsReordering(true)}
          >
            <SortableContext
              items={displayedCatRows.map((r) => r.catId)}
              strategy={verticalListSortingStrategy}
            >
              <CardContent className="p-0">
                <div className="divide-y">
                  {displayedCatRows.map(({ catId, name, icon, color, spent, limit, hasLimit, pct }) => {
                    const cappedPct = pct !== null ? Math.min(pct, 100) : null;
                    const amountColor =
                      spent === 0 ? "text-muted-foreground/50" :
                      pct === null ? "text-foreground" :
                      pct > 100 ? "text-red-500 font-bold" :
                      pct >= 80 ? "text-amber-600 font-semibold" :
                      "text-green-600 font-semibold";
                    const barClass =
                      pct !== null && pct > 100 ? "[&>div]:bg-red-500" :
                      pct !== null && pct >= 80 ? "[&>div]:bg-amber-400" :
                      pct !== null ? "[&>div]:bg-green-500" : "";

                    return (
                      <SortableCategoryRow key={catId} id={catId} isReordering={isReordering}>
                        <div className={`px-4 py-3 ${spent === 0 && !isReordering ? "opacity-50" : ""}`}>
                          <div className="flex items-center justify-between gap-3 mb-1.5">
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="text-base w-6 text-center flex-shrink-0" style={{ color }}>
                                {icon ?? "📦"}
                              </span>
                              <span className="text-sm font-medium truncate">{name}</span>
                            </span>
                            <span className={`text-xs tabular-nums flex-shrink-0 ${amountColor}`}>
                              {hasLimit
                                ? `${formatCurrency(spent, currency)} / ${formatCurrency(limit!, currency)}`
                                : formatCurrency(spent, currency)}
                            </span>
                          </div>
                          {hasLimit && cappedPct !== null && (
                            <Progress value={cappedPct} className={`h-1.5 ${barClass}`} />
                          )}
                        </div>
                      </SortableCategoryRow>
                    );
                  })}
                </div>
              </CardContent>
            </SortableContext>
          </DndContext>
        </Card>
      )}

      {/* Recurring items */}
      {recurrings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              {t.recurring_title}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {recurrings.map((r) => {
              const cat = categories.find((c) => c.id === r.categoryId);
              const isBooked = bookedRecurringIds.has(r.id);
              const bookedTx = transactions.find((tx) => tx.recurringId === r.id);
              const sign = r.type === "income" ? "+" : "−";
              const amountColor = r.type === "income" ? "text-green-600" : "text-red-500";
              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 px-4 py-2.5 ${isBooked ? "opacity-60" : ""}`}
                >
                  <Checkbox
                    checked={isBooked}
                    onCheckedChange={(checked) => handleRecurringCheck(r, !!checked)}
                    className="flex-shrink-0"
                  />
                  <span className="text-lg w-7 text-center flex-shrink-0">{cat?.icon ?? "🔄"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.merchantDisplay || cat?.name}</p>
                    <Badge variant="outline" className="text-xs py-0 mt-0.5">
                      {cadenceLabel(r.cadence)}
                    </Badge>
                  </div>
                  {isBooked ? (
                    <span className={`font-semibold text-sm flex-shrink-0 ${amountColor}`}>
                      {sign}{formatCurrency(bookedTx?.amount ?? r.amount, currency)}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className={`text-sm font-semibold ${amountColor}`}>{sign}</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={overrideAmounts[r.id] ?? r.amount}
                        onChange={(e) =>
                          setOverrideAmounts((prev) => ({
                            ...prev,
                            [r.id]: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="w-24 h-7 text-sm text-right px-2"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Recent transactions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.dashboard_recent_transactions}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {transactions.slice(0, 8).map((tx) => {
            const cat = categories.find((c) => c.id === tx.categoryId);
            return (
              <div key={tx.id} className="flex items-center gap-3 py-1.5">
                <span className="text-xl w-8 text-center flex-shrink-0">{cat?.icon ?? "📦"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tx.merchantDisplay || cat?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {cat?.name} · {formatDate(tx.date.toDate())}
                    {tx.tags?.length > 0 && (() => {
                      const txTagNames = tx.tags
                        .map((id) => tags.find((tg) => tg.id === id)?.name)
                        .filter(Boolean)
                        .join(", ");
                      return txTagNames ? <span> · {txTagNames}</span> : null;
                    })()}
                  </p>
                </div>
                <span
                  className={`font-semibold text-sm flex-shrink-0 ${
                    tx.type === "income" ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {tx.type === "income" ? "+" : "−"}{formatCurrency(tx.amount, currency)}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setEditTx(tx)}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(tx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
          {transactions.length === 0 && !dataLoading && (
            <p className="text-center text-muted-foreground text-sm py-6">
              {t.dashboard_no_transactions}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editTx} onOpenChange={(o) => !o && setEditTx(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.dashboard_edit_transaction}</DialogTitle>
          </DialogHeader>
          {editTx && (
            <TransactionForm
              existing={editTx}
              onDone={() => {
                setEditTx(null);
                loadData();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-40" />
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  );
}
