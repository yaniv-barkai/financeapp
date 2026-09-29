"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  RotateCcw,
  GripVertical,
} from "lucide-react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAppStore } from "@/lib/store";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import {
  getDebts,
  addDebt,
  updateDebt,
  deleteDebt,
  setDebtPayoffOrders,
} from "@/lib/firestore/debts";
import { getDebtPlan } from "@/lib/firestore/debt-plan";
import {
  getAllTransactions,
  updateTransaction,
} from "@/lib/firestore/transactions";
import { upsertMerchant } from "@/lib/firestore/merchants";
import {
  deleteDebtRecurring,
  resolveDebtsCategoryId,
  syncDebtRecurring,
} from "@/lib/debt-recurring";
import {
  estimateDebtInterest,
  runSnowball,
  sortDebtsByPayoffOrder,
  toSnowballDebtInput,
  type DebtInterestEstimate,
} from "@/lib/snowball";
import {
  daysUntilDue,
  DUE_SOON_DAYS,
  parseDueDate,
  projectionMonthEnd,
} from "@/lib/debt-due";
import { getIntlLocale } from "@/lib/i18n";
import {
  effectiveAnnualRate,
  ISRAEL_PRIME_AS_OF,
  ISRAEL_PRIME_RATE,
} from "@/lib/prime";
import { Debt, DebtStatus, SnowballPlan, Transaction } from "@/lib/types";
import { cn, formatCurrency, formatDate, normalizemerchant } from "@/lib/utils";
import { CategoryPicker } from "@/components/transactions/CategoryPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { DebtPaidCelebration } from "@/components/debts/DebtPaidCelebration";

type StatusFilter = "open" | "paid" | "all";
type DebtForm = Omit<Debt, "id" | "createdAt">;

const BLANK: DebtForm = {
  name: "",
  balance: 0,
  monthlyPayment: 0,
  interestType: "fixed",
  annualInterestRate: 0,
  primeMargin: 0,
  forcePhase1: false,
  transactionIds: [],
  matchMerchants: [],
  status: "open",
};

function txLabel(tx: Transaction) {
  return tx.merchantDisplay || tx.note || "—";
}

function parsePositive(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

type DragHandle = {
  ref: (el: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
};

function SortableDebtRow({
  id,
  disabled,
  className,
  children,
}: {
  id: string;
  disabled: boolean;
  className?: string;
  children: (handle: DragHandle) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        className,
        isDragging && "relative z-10 bg-background shadow-lg ring-1 ring-primary/40 rounded-md"
      )}
    >
      {children({ ref: setActivatorNodeRef, attributes, listeners })}
    </div>
  );
}

export default function DebtsPage() {
  const { loading: authLoading } = useRequireAuth();
  const { user } = useAuth();
  const { activeBookId, categories, currency } = useAppStore();
  const { t, locale } = useLocale();
  const confirm = useConfirm();
  const isRtl = locale === "he";
  const align = isRtl ? "text-right" : "text-left";

  const [loading, setLoading] = useState(true);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [plan, setPlan] = useState<SnowballPlan | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Debt | null>(null);
  const [form, setForm] = useState<DebtForm>(BLANK);
  const [balanceStr, setBalanceStr] = useState("");
  const [monthlyStr, setMonthlyStr] = useState("");
  const [interestStr, setInterestStr] = useState("");
  const [marginStr, setMarginStr] = useState("");
  const [marginNegative, setMarginNegative] = useState(false);
  const [saving, setSaving] = useState(false);
  const [txSearch, setTxSearch] = useState("");
  const [prefill, setPrefill] = useState<{ name: string; monthly: string }>({
    name: "",
    monthly: "",
  });
  const [celebrationName, setCelebrationName] = useState<string | null>(null);
  const [celebrationKey, setCelebrationKey] = useState(0);

  const celebratePaid = (name: string) => {
    setCelebrationName(name);
    setCelebrationKey((k) => k + 1);
  };

  const txById = useMemo(() => {
    const map = new Map<string, Transaction>();
    for (const tx of transactions) map.set(tx.id, tx);
    return map;
  }, [transactions]);

  const loadData = useCallback(async () => {
    if (!user || !activeBookId) return;
    setLoading(true);
    try {
      const [d, txs, p] = await Promise.all([
        getDebts(user.uid, activeBookId),
        getAllTransactions(user.uid, activeBookId),
        getDebtPlan(user.uid, activeBookId).catch(() => null),
      ]);
      setDebts(d);
      setTransactions(txs);
      setPlan(p);
    } catch {
      toast.error(t.debts_load_error);
    } finally {
      setLoading(false);
    }
  }, [user, activeBookId, t.debts_load_error]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openOrdered = useMemo(
    () => sortDebtsByPayoffOrder(debts.filter((d) => d.status === "open")),
    [debts]
  );

  const filtered = useMemo(() => {
    if (statusFilter === "open") return openOrdered;
    const paid = sortDebtsByPayoffOrder(
      debts.filter((d) => d.status === "paid")
    );
    return statusFilter === "paid" ? paid : [...openOrdered, ...paid];
  }, [debts, openOrdered, statusFilter]);

  const positionById = useMemo(
    () => new Map(openOrdered.map((d, i) => [d.id, i + 1])),
    [openOrdered]
  );

  const payoffMonthById = useMemo(() => {
    if (!plan || (plan.nominalMonthlyIncome <= 0 && plan.monthlyExtra <= 0)) {
      return null;
    }
    const inputs = openOrdered
      .map(toSnowballDebtInput)
      .filter((d): d is NonNullable<typeof d> => d !== null);
    return runSnowball(inputs, plan).debtPayoffMonth;
  }, [openOrdered, plan]);

  const hasManualOrder = openOrdered.some((d) => d.payoffOrder !== undefined);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const saveOrders = async (orders: Record<string, number | null>) => {
    if (!user || !activeBookId || Object.keys(orders).length === 0) return;
    setDebts((prev) =>
      prev.map((d) =>
        d.id in orders
          ? { ...d, payoffOrder: orders[d.id] ?? undefined }
          : d
      )
    );
    try {
      await setDebtPayoffOrders(user.uid, activeBookId, orders);
    } catch {
      toast.error(t.debts_order_save_error);
      await loadData();
    }
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = openOrdered.findIndex((d) => d.id === active.id);
    let to = openOrdered.findIndex((d) => d.id === over.id);
    if (from < 0 || to < 0) return;
    // "Pay first" debts always lead, so a drop across that boundary stops at its edge.
    const payFirst = openOrdered[from].forcePhase1;
    const groupStart = payFirst ? 0 : openOrdered.findIndex((d) => !d.forcePhase1);
    const groupEnd = payFirst
      ? openOrdered.filter((d) => d.forcePhase1).length - 1
      : openOrdered.length - 1;
    to = Math.min(Math.max(to, groupStart), groupEnd);
    if (to === from) return;
    const next = arrayMove(openOrdered, from, to);
    const orders: Record<string, number> = {};
    next.forEach((d, i) => {
      if (d.payoffOrder !== i) orders[d.id] = i;
    });
    void saveOrders(orders);
  };

  const resetOrder = () => {
    const orders: Record<string, null> = {};
    for (const d of debts) if (d.payoffOrder !== undefined) orders[d.id] = null;
    void saveOrders(orders);
  };

  const monthYear = new Intl.DateTimeFormat(getIntlLocale(locale), {
    month: "short",
    year: "numeric",
  });

  const debtTotals = useMemo(() => {
    let balance = 0;
    let monthly = 0;
    let count = 0;
    for (const d of debts) {
      if (d.status !== "open" || d.balance <= 0) continue;
      balance += d.balance;
      monthly += d.monthlyPayment;
      count += 1;
    }
    return { balance, monthly, count };
  }, [debts]);

  const interestById = useMemo(() => {
    const map = new Map<string, DebtInterestEstimate>();
    for (const d of debts) {
      const rate = effectiveAnnualRate(d);
      if (d.status !== "open" || rate <= 0) continue;
      map.set(d.id, estimateDebtInterest(d.balance, rate, d.monthlyPayment));
    }
    return map;
  }, [debts]);

  const interestSummary = useMemo(() => {
    let total = 0;
    let scheduled = 0;
    let ongoingMonthly = 0;
    let ongoing = 0;
    for (const est of interestById.values()) {
      if (est.totalInterest === null) {
        ongoing += 1;
        ongoingMonthly += est.monthlyInterestNow;
      } else {
        scheduled += 1;
        total += est.totalInterest;
      }
    }
    return { total, scheduled, ongoingMonthly, ongoing };
  }, [interestById]);

  const ongoingInterestText = (monthly: number) =>
    t.debts_interest_ongoing_amount
      .replace("{monthly}", formatCurrency(monthly, currency))
      .replace("{yearly}", formatCurrency(monthly * 12, currency));

  const renderDueBadge = (dueDate: string) => {
    const days = daysUntilDue(dueDate);
    const date = parseDueDate(dueDate);
    if (days === null || !date) return null;
    const dateLabel = formatDate(date);
    if (days < 0) {
      return (
        <Badge variant="destructive" className="text-xs py-0">
          {t.debts_overdue.replace("{date}", dateLabel)}
        </Badge>
      );
    }
    if (days <= DUE_SOON_DAYS) {
      return (
        <Badge className="text-xs py-0 bg-amber-500 text-white hover:bg-amber-500">
          {days === 0
            ? t.debts_due_today
            : t.debts_due_soon.replace("{n}", String(days))}{" "}
          · {dateLabel}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs py-0">
        {t.debts_due_badge.replace("{date}", dateLabel)}
      </Badge>
    );
  };

  const renderInterestLines = (
    est: DebtInterestEstimate,
    monthlyPayment: number
  ) => {
    if (est.totalInterest !== null) {
      return (
        <p className="text-xs text-muted-foreground">
          {t.debts_expected_interest}:{" "}
          <span className="text-red-500 font-medium">
            {formatCurrency(est.totalInterest, currency)}
          </span>
          {est.months ? (
            <> ({t.debts_interest_months.replace("{n}", String(est.months))})</>
          ) : null}
        </p>
      );
    }
    return (
      <>
        {monthlyPayment > 0 && (
          <p className="text-xs text-amber-600">{t.debts_interest_never}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {t.debts_interest_ongoing_label}:{" "}
          <span className="text-red-500 font-medium">
            {ongoingInterestText(est.monthlyInterestNow)}
          </span>{" "}
          {t.debts_interest_until_paid}
        </p>
      </>
    );
  };

  const formPrimeMargin =
    (marginNegative ? -1 : 1) * parsePositive(marginStr);
  const formRate = effectiveAnnualRate({
    interestType: form.interestType,
    annualInterestRate: parsePositive(interestStr),
    primeMargin: formPrimeMargin,
  });

  const formInterestEstimate = useMemo(() => {
    const balance = parsePositive(balanceStr);
    if (formRate <= 0 || balance <= 0) return null;
    return estimateDebtInterest(balance, formRate, parsePositive(monthlyStr));
  }, [formRate, balanceStr, monthlyStr]);

  const openNew = () => {
    setEditItem(null);
    const defaultCat = resolveDebtsCategoryId(categories);
    setForm({ ...BLANK, categoryId: defaultCat || undefined });
    setBalanceStr("");
    setMonthlyStr("");
    setInterestStr("");
    setMarginStr("");
    setMarginNegative(false);
    setTxSearch("");
    setPrefill({ name: "", monthly: "" });
    setShowForm(true);
  };

  const openEdit = (debt: Debt) => {
    setEditItem(debt);
    setForm({
      name: debt.name,
      balance: debt.balance,
      monthlyPayment: debt.monthlyPayment,
      interestType: debt.interestType,
      annualInterestRate: debt.annualInterestRate,
      primeMargin: debt.primeMargin,
      forcePhase1: debt.forcePhase1,
      recurringId: debt.recurringId,
      transactionIds: [...debt.transactionIds],
      matchMerchants: [...debt.matchMerchants],
      categoryId: debt.categoryId,
      note: debt.note,
      dueDate: debt.dueDate,
      status: debt.status,
    });
    setBalanceStr(debt.balance > 0 ? String(debt.balance) : "");
    setMonthlyStr(debt.monthlyPayment > 0 ? String(debt.monthlyPayment) : "");
    setInterestStr(
      debt.annualInterestRate > 0 ? String(debt.annualInterestRate) : ""
    );
    setMarginStr(debt.primeMargin ? String(Math.abs(debt.primeMargin)) : "");
    setMarginNegative(debt.primeMargin < 0);
    setTxSearch("");
    setPrefill({ name: "", monthly: "" });
    setShowForm(true);
  };

  const merchantsFromAttached = (
    ids: string[],
    existing: string[]
  ): string[] => {
    const set = new Set(existing);
    for (const id of ids) {
      const tx = txById.get(id);
      if (!tx) continue;
      const norm =
        tx.merchantNormalized?.trim() ||
        (tx.merchantDisplay ? normalizemerchant(tx.merchantDisplay) : "");
      if (norm) set.add(norm);
    }
    return [...set];
  };

  const handleSave = async () => {
    if (!user || !activeBookId) return;
    const name = form.name.trim();
    if (!name) return;
    setSaving(true);
    try {
      const balance = parsePositive(balanceStr);
      const monthlyPayment = parsePositive(monthlyStr);
      const annualInterestRate = parsePositive(interestStr);
      const categoryId =
        form.categoryId || resolveDebtsCategoryId(categories) || undefined;
      const matchMerchants = merchantsFromAttached(
        form.transactionIds,
        form.matchMerchants
      );
      const status: DebtStatus =
        balance <= 0 && form.status === "open" ? "paid" : form.status;

      const payload: Omit<Debt, "id" | "createdAt"> = {
        name,
        balance,
        monthlyPayment,
        interestType: form.interestType,
        annualInterestRate,
        primeMargin: formPrimeMargin,
        forcePhase1: form.forcePhase1,
        recurringId: form.recurringId,
        transactionIds: form.transactionIds,
        matchMerchants,
        categoryId,
        note: form.note?.trim() || undefined,
        // "" rather than undefined so clearing the date on edit overwrites it.
        dueDate: form.dueDate || "",
        status,
      };

      const recurringId = await syncDebtRecurring(
        user.uid,
        activeBookId,
        { ...payload, recurringId: form.recurringId },
        categories
      );
      payload.recurringId = recurringId;

      let debtId = editItem?.id;
      if (editItem) {
        await updateDebt(user.uid, activeBookId, editItem.id, payload);
      } else {
        debtId = await addDebt(user.uid, activeBookId, payload);
      }

      const catForMerchant =
        categoryId || resolveDebtsCategoryId(categories);
      if (catForMerchant && debtId) {
        for (const id of form.transactionIds) {
          const tx = txById.get(id);
          if (!tx) continue;
          await updateTransaction(user.uid, activeBookId, id, { debtId });
          if (tx.merchantDisplay) {
            await upsertMerchant(
              user.uid,
              activeBookId,
              tx.merchantDisplay,
              catForMerchant
            );
          }
        }
      }

      if (monthlyPayment > 0) {
        toast.success(t.debts_recurring_synced);
      } else {
        toast.success(t.debts_saved);
      }
      const becamePaid =
        status === "paid" && (!editItem || editItem.status !== "paid");
      if (becamePaid) celebratePaid(name);
      setShowForm(false);
      await loadData();
    } catch {
      toast.error(t.debts_save_error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (debt: Debt) => {
    if (!user || !activeBookId) return;
    const ok = await confirm({
      title: t.debts_delete_confirm_title,
      message: t.debts_delete_confirm,
      confirmLabel: t.debts_delete,
      cancelLabel: t.debts_cancel,
      variant: "destructive",
    });
    if (!ok) return;
    await deleteDebtRecurring(user.uid, activeBookId, debt.recurringId);
    await deleteDebt(user.uid, activeBookId, debt.id);
    toast.success(t.debts_deleted);
    await loadData();
  };

  const handleToggleStatus = async (debt: Debt) => {
    if (!user || !activeBookId) return;
    const next: DebtStatus = debt.status === "open" ? "paid" : "open";
    const recurringId = await syncDebtRecurring(
      user.uid,
      activeBookId,
      {
        name: debt.name,
        monthlyPayment: debt.monthlyPayment,
        recurringId: debt.recurringId,
        categoryId: debt.categoryId,
        status: next,
        note: debt.note,
      },
      categories
    );
    await updateDebt(user.uid, activeBookId, debt.id, {
      status: next,
      ...(next === "paid" ? { balance: 0 } : {}),
      recurringId,
    });
    toast.success(next === "paid" ? t.debts_mark_paid : t.debts_mark_open);
    if (next === "paid") celebratePaid(debt.name);
    await loadData();
  };

  const attachTx = (id: string) => {
    if (form.transactionIds.includes(id)) return;
    const tx = txById.get(id);
    let name = form.name;
    const nextPrefill = { ...prefill };
    if (tx) {
      // Only overwrite fields that are empty or still hold a previous auto-fill.
      const txName = (tx.merchantDisplay || tx.note || "").trim();
      const nameIsAuto = !form.name.trim() || form.name === prefill.name;
      if (txName && nameIsAuto) {
        name = txName;
        nextPrefill.name = txName;
      }
      const txMonthly = String(Math.abs(tx.amount));
      const monthlyIsAuto = !monthlyStr.trim() || monthlyStr === prefill.monthly;
      if (tx.amount && monthlyIsAuto) {
        setMonthlyStr(txMonthly);
        nextPrefill.monthly = txMonthly;
      }
    }
    setPrefill(nextPrefill);
    setForm({ ...form, name, transactionIds: [...form.transactionIds, id] });
    setTxSearch("");
  };

  const detachTx = (id: string) => {
    setForm((f) => ({
      ...f,
      transactionIds: f.transactionIds.filter((x) => x !== id),
    }));
  };

  const searchLower = txSearch.trim().toLowerCase();
  const pickerResults = useMemo(() => {
    const available = transactions.filter(
      (tx) => !form.transactionIds.includes(tx.id)
    );
    if (!searchLower) return available.slice(0, 20);
    return available
      .filter((tx) => {
        const hay = `${tx.merchantDisplay ?? ""} ${tx.note ?? ""}`.toLowerCase();
        return hay.includes(searchLower);
      })
      .slice(0, 20);
  }, [transactions, form.transactionIds, searchLower]);

  if (authLoading) return null;

  return (
    <div className="space-y-5">
      <DebtPaidCelebration
        key={celebrationKey}
        open={celebrationName !== null}
        debtName={celebrationName ?? ""}
        title={t.debts_celebration_title}
        onDone={() => setCelebrationName(null)}
      />
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold">{t.debts_title}</h1>
          <p className={cn("text-sm text-muted-foreground mt-1", align)}>
            {t.debts_subtitle}
          </p>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          <span className="max-sm:sr-only">{t.debts_add}</span>
        </Button>
      </div>

      {loading ? (
        <p className={cn("text-sm text-muted-foreground py-8", align)}>
          {t.debts_loading}
        </p>
      ) : (
        <>
          <Tabs
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <TabsList>
              <TabsTrigger value="open">{t.debts_tab_open}</TabsTrigger>
              <TabsTrigger value="paid">{t.debts_tab_paid}</TabsTrigger>
              <TabsTrigger value="all">{t.debts_tab_all}</TabsTrigger>
            </TabsList>
          </Tabs>

          {debtTotals.count > 0 && statusFilter !== "paid" && (
            <Card>
              <CardContent
                className={cn("p-4 grid gap-4 sm:grid-cols-2", align)}
              >
                <div
                  className={cn(
                    "space-y-1 sm:col-span-2",
                    interestById.size > 0 && "border-b pb-4"
                  )}
                >
                  <p className="text-xs text-muted-foreground">
                    {t.debts_total}
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(debtTotals.balance, currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.debts_total_hint
                      .replace("{n}", String(debtTotals.count))
                      .replace(
                        "{monthly}",
                        formatCurrency(debtTotals.monthly, currency)
                      )}
                  </p>
                </div>
                {interestSummary.scheduled > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {t.debts_interest_summary}
                    </p>
                    <p className="text-xl font-semibold text-red-500">
                      {formatCurrency(interestSummary.total, currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.debts_interest_summary_hint}
                    </p>
                  </div>
                )}
                {interestSummary.ongoing > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {t.debts_interest_ongoing_title}
                    </p>
                    <p className="text-xl font-semibold text-red-500">
                      {ongoingInterestText(interestSummary.ongoingMonthly)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.debts_interest_ongoing_hint}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {statusFilter !== "paid" && openOrdered.length > 1 && (
            <div
              className={cn(
                "flex flex-wrap items-start justify-between gap-2 text-xs text-muted-foreground",
                align
              )}
            >
              <p className="flex-1 min-w-0">
                {t.debts_order_hint}
                {!payoffMonthById && (
                  <>
                    {" "}
                    <Link
                      href="/simulation"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {t.debts_order_no_plan}
                    </Link>
                  </>
                )}
              </p>
              {hasManualOrder && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={resetOrder}
                >
                  {t.debts_order_reset}
                </Button>
              )}
            </div>
          )}

          <Card>
            <CardContent className="p-0 divide-y">
              {filtered.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-10">
                  {t.debts_no_items}
                </p>
              )}
              <DndContext
                id="debts-payoff-order"
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
              <SortableContext
                items={openOrdered.map((d) => d.id)}
                strategy={verticalListSortingStrategy}
              >
              {filtered.map((debt) => {
                const position = positionById.get(debt.id);
                const closesAt = payoffMonthById?.[debt.id];
                const sortable = position !== undefined && openOrdered.length > 1;
                return (
                <SortableDebtRow
                  key={debt.id}
                  id={debt.id}
                  disabled={!sortable}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    debt.status === "paid" && "opacity-60"
                  )}
                >
                  {(handle) => (
                  <>
                  {position !== undefined && (
                    <button
                      type="button"
                      ref={handle.ref}
                      {...handle.attributes}
                      {...handle.listeners}
                      disabled={!sortable}
                      title={t.debts_order_drag}
                      aria-label={t.debts_order_drag}
                      className="flex items-center gap-0.5 shrink-0 -ms-2 py-2 ps-0.5 pe-1 rounded touch-none cursor-grab active:cursor-grabbing hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      {sortable && (
                        <GripVertical className="h-4 w-4 text-muted-foreground/60" />
                      )}
                      <span className="text-xs font-semibold tabular-nums min-w-[1ch]">
                        {position}
                      </span>
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{debt.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge variant="outline" className="text-xs py-0">
                        {formatCurrency(debt.balance, currency)}
                      </Badge>
                      {debt.monthlyPayment > 0 && (
                        <Badge variant="secondary" className="text-xs py-0">
                          {t.debts_monthly_badge}:{" "}
                          {formatCurrency(debt.monthlyPayment, currency)}
                        </Badge>
                      )}
                      {debt.interestType === "prime" ? (
                        <Badge variant="secondary" className="text-xs py-0">
                          {t.debts_interest_badge}: {t.debts_prime_label}{" "}
                          {debt.primeMargin < 0 ? "−" : "+"}{" "}
                          {Math.abs(debt.primeMargin)}% (
                          {effectiveAnnualRate(debt)}%)
                        </Badge>
                      ) : (
                        debt.annualInterestRate > 0 && (
                          <Badge variant="secondary" className="text-xs py-0">
                            {t.debts_interest_badge}: {debt.annualInterestRate}%
                          </Badge>
                        )
                      )}
                      {debt.dueDate &&
                        debt.status === "open" &&
                        renderDueBadge(debt.dueDate)}
                      {debt.forcePhase1 && debt.status === "open" && (
                        <Badge variant="default" className="text-xs py-0">
                          {t.debts_pay_first_badge}
                        </Badge>
                      )}
                      {closesAt !== undefined && (
                        <Badge
                          variant="outline"
                          className="text-xs py-0 border-green-600/40 text-green-700 dark:text-green-400"
                        >
                          {t.debts_closes_badge
                            .replace("{n}", String(closesAt))
                            .replace(
                              "{date}",
                              monthYear.format(projectionMonthEnd(closesAt))
                            )}
                        </Badge>
                      )}
                      {debt.status === "paid" && (
                        <Badge variant="outline" className="text-xs py-0">
                          {t.debts_status_paid}
                        </Badge>
                      )}
                    </div>
                    {interestById.has(debt.id) && (
                      <div className="mt-1">
                        {renderInterestLines(
                          interestById.get(debt.id)!,
                          debt.monthlyPayment
                        )}
                      </div>
                    )}
                    {debt.note && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {debt.note}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => handleToggleStatus(debt)}
                    title={
                      debt.status === "open"
                        ? t.debts_mark_paid
                        : t.debts_mark_open
                    }
                  >
                    {debt.status === "open" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(debt)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(debt)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  </div>
                  </>
                  )}
                </SortableDebtRow>
                );
              })}
              </SortableContext>
              </DndContext>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editItem ? t.debts_edit_title : t.debts_new_title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
              <Label>{t.debts_attach_transactions}</Label>
              <p className="text-xs text-muted-foreground">
                {editItem
                  ? t.debts_recognition_hint
                  : t.debts_attach_prefill_hint}
              </p>
              {form.transactionIds.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-2">
                  <span className="text-xs text-muted-foreground">
                    {t.debts_attached}
                  </span>
                  {form.transactionIds.map((id) => {
                    const tx = txById.get(id);
                    if (!tx) {
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs"
                        >
                          <span className="flex-1 truncate text-muted-foreground">
                            {id}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => detachTx(id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs"
                      >
                        <span className="flex-1 min-w-0 truncate">
                          {txLabel(tx)} · {formatDate(tx.date.toDate())}
                        </span>
                        <span className="text-red-500 font-medium flex-shrink-0">
                          {formatCurrency(tx.amount, currency)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => detachTx(id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              <Input
                placeholder={t.debts_search_transactions}
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
              />
              <div className="mt-1 max-h-40 overflow-y-auto divide-y rounded-md border bg-background">
                {pickerResults.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">
                    {t.debts_no_matching_transactions}
                  </p>
                ) : (
                  pickerResults.map((tx) => (
                    <button
                      key={tx.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs hover:bg-accent"
                      onClick={() => attachTx(tx.id)}
                    >
                      <span className="flex-1 min-w-0 truncate">
                        {txLabel(tx)} · {formatDate(tx.date.toDate())}
                      </span>
                      <span
                        className={
                          tx.type === "expense"
                            ? "text-red-500 font-medium flex-shrink-0"
                            : "text-green-600 font-medium flex-shrink-0"
                        }
                      >
                        {formatCurrency(tx.amount, currency)}
                      </span>
                    </button>
                  ))
                )}
              </div>
              {merchantsFromAttached(form.transactionIds, form.matchMerchants)
                .length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t.debts_recognition_merchants}:{" "}
                  {merchantsFromAttached(
                    form.transactionIds,
                    form.matchMerchants
                  ).join(", ")}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t.debts_name}</Label>
              <Input
                placeholder={t.debts_name_placeholder}
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t.debts_balance}</Label>
                <Input
                  inputMode="decimal"
                  value={balanceStr}
                  onChange={(e) => setBalanceStr(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t.debts_monthly_payment}</Label>
                <Input
                  inputMode="decimal"
                  value={monthlyStr}
                  onChange={(e) => setMonthlyStr(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              {t.debts_monthly_payment_hint}
            </p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>{t.debts_interest_rate}</Label>
                <Tabs
                  value={form.interestType}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      interestType: v as Debt["interestType"],
                    }))
                  }
                >
                  <TabsList className="h-8">
                    <TabsTrigger value="fixed" className="text-xs">
                      {t.debts_interest_type_fixed}
                    </TabsTrigger>
                    <TabsTrigger value="prime" className="text-xs">
                      {t.debts_interest_type_prime}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              {form.interestType === "prime" ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground shrink-0">
                      {t.debts_prime_label}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-base"
                      title={t.debts_prime_sign_toggle}
                      onClick={() => setMarginNegative((n) => !n)}
                    >
                      {marginNegative ? "−" : "+"}
                    </Button>
                    <Input
                      inputMode="decimal"
                      value={marginStr}
                      onChange={(e) => setMarginStr(e.target.value)}
                      placeholder="0"
                    />
                    <span className="text-sm text-muted-foreground shrink-0">
                      %
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.debts_prime_hint
                      .replace("{prime}", String(ISRAEL_PRIME_RATE))
                      .replace(
                        "{date}",
                        formatDate(new Date(`${ISRAEL_PRIME_AS_OF}T00:00:00`))
                      )
                      .replace("{rate}", String(formRate))}
                  </p>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    inputMode="decimal"
                    value={interestStr}
                    onChange={(e) => setInterestStr(e.target.value)}
                    placeholder="0"
                  />
                  <span className="text-sm text-muted-foreground shrink-0">
                    %
                  </span>
                </div>
              )}
              {formInterestEstimate === null ? (
                form.interestType === "fixed" && (
                  <p className="text-xs text-muted-foreground">
                    {t.debts_interest_rate_hint}
                  </p>
                )
              ) : formInterestEstimate.totalInterest === null ? (
                renderInterestLines(
                  formInterestEstimate,
                  parsePositive(monthlyStr)
                )
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t.debts_expected_interest_detail
                    .replace(
                      "{amount}",
                      formatCurrency(formInterestEstimate.totalInterest, currency)
                    )
                    .replace("{n}", String(formInterestEstimate.months))}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t.debts_due_date}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={form.dueDate ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      dueDate: e.target.value || undefined,
                    }))
                  }
                />
                {form.dueDate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    title={t.debts_due_date_clear}
                    onClick={() =>
                      setForm((f) => ({ ...f, dueDate: undefined }))
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t.debts_due_date_hint}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <div>
                <Label>{t.debts_pay_first}</Label>
                <p className="text-xs text-muted-foreground">
                  {t.debts_pay_first_hint}
                </p>
              </div>
              <Switch
                checked={form.forcePhase1}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, forcePhase1: v }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.debts_category}</Label>
              <CategoryPicker
                typeFilter="expense"
                value={form.categoryId ?? ""}
                onChange={(id) =>
                  setForm((f) => ({ ...f, categoryId: id || undefined }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.debts_note}</Label>
              <Input
                placeholder={t.debts_note_placeholder}
                value={form.note ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, note: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              {t.debts_cancel}
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving
                ? t.debts_saving
                : editItem
                  ? t.debts_save
                  : t.debts_create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
