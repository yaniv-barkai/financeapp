"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
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
} from "@/lib/firestore/debts";
import {
  getAllTransactions,
  updateTransaction,
} from "@/lib/firestore/transactions";
import { upsertMerchant } from "@/lib/firestore/merchants";
import {
  deactivateDebtRecurring,
  resolveDebtsCategoryId,
  syncDebtRecurring,
} from "@/lib/debt-recurring";
import { Debt, DebtStatus, Transaction } from "@/lib/types";
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Debt | null>(null);
  const [form, setForm] = useState<DebtForm>(BLANK);
  const [balanceStr, setBalanceStr] = useState("");
  const [monthlyStr, setMonthlyStr] = useState("");
  const [saving, setSaving] = useState(false);
  const [txSearch, setTxSearch] = useState("");
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
      const [d, txs] = await Promise.all([
        getDebts(user.uid, activeBookId),
        getAllTransactions(user.uid, activeBookId),
      ]);
      setDebts(d);
      setTransactions(txs);
    } catch {
      toast.error(t.debts_load_error);
    } finally {
      setLoading(false);
    }
  }, [user, activeBookId, t.debts_load_error]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const list =
      statusFilter === "all"
        ? debts
        : debts.filter((d) => d.status === statusFilter);
    return [...list].sort((a, b) => {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      return a.balance - b.balance || a.name.localeCompare(b.name);
    });
  }, [debts, statusFilter]);

  const openNew = () => {
    setEditItem(null);
    const defaultCat = resolveDebtsCategoryId(categories);
    setForm({ ...BLANK, categoryId: defaultCat || undefined });
    setBalanceStr("");
    setMonthlyStr("");
    setTxSearch("");
    setShowForm(true);
  };

  const openEdit = (debt: Debt) => {
    setEditItem(debt);
    setForm({
      name: debt.name,
      balance: debt.balance,
      monthlyPayment: debt.monthlyPayment,
      forcePhase1: debt.forcePhase1,
      recurringId: debt.recurringId,
      transactionIds: [...debt.transactionIds],
      matchMerchants: [...debt.matchMerchants],
      categoryId: debt.categoryId,
      note: debt.note,
      status: debt.status,
    });
    setBalanceStr(debt.balance > 0 ? String(debt.balance) : "");
    setMonthlyStr(debt.monthlyPayment > 0 ? String(debt.monthlyPayment) : "");
    setTxSearch("");
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
        forcePhase1: form.forcePhase1,
        recurringId: form.recurringId,
        transactionIds: form.transactionIds,
        matchMerchants,
        categoryId,
        note: form.note?.trim() || undefined,
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
    await deactivateDebtRecurring(user.uid, activeBookId, debt.recurringId);
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
    setForm((f) =>
      f.transactionIds.includes(id)
        ? f
        : { ...f, transactionIds: [...f.transactionIds, id] }
    );
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

          <Card>
            <CardContent className="p-0 divide-y">
              {filtered.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-10">
                  {t.debts_no_items}
                </p>
              )}
              {filtered.map((debt) => (
                <div
                  key={debt.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    debt.status === "paid" && "opacity-60"
                  )}
                >
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
                      {debt.forcePhase1 && debt.status === "open" && (
                        <Badge variant="default" className="text-xs py-0">
                          {t.debts_pay_first_badge}
                        </Badge>
                      )}
                      {debt.status === "paid" && (
                        <Badge variant="outline" className="text-xs py-0">
                          {t.debts_status_paid}
                        </Badge>
                      )}
                    </div>
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
                </div>
              ))}
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

            <div className="space-y-1.5">
              <Label>{t.debts_attach_transactions}</Label>
              <p className="text-xs text-muted-foreground">
                {t.debts_recognition_hint}
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
                          className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
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
                        className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
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
              <div className="mt-1 max-h-40 overflow-y-auto divide-y rounded-md border">
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
