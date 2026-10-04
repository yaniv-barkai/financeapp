"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Eraser,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAppStore } from "@/lib/store";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import {
  getSimulation,
  saveSimulation,
} from "@/lib/firestore/simulations";
import { getRecurring, toMonthlyRecurringAmount } from "@/lib/firestore/recurring";
import { getTransactionsByMonth } from "@/lib/firestore/transactions";
import { getDebts } from "@/lib/firestore/debts";
import { isAutoDebtRecurring } from "@/lib/debt-recurring";
import { sortDebtsByPayoffOrder } from "@/lib/snowball";
import {
  averageExpenseByCategory,
  averageIncomeByCategory,
  computeExpenseByCategory,
  computeIncomeByCategory,
  lookbackMonthKeys,
} from "@/lib/budget";
import { Debt, SimulationWhatIfCategory, TransactionType } from "@/lib/types";
import {
  cn,
  formatCurrency,
  getCategoryDisplayName,
  getMonthKey,
  getMonthRange,
  getPrevMonthKey,
} from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DebtPayoffPanel } from "@/components/simulation/DebtPayoffPanel";

function parseAmount(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function amountToInput(value: number | undefined): string {
  if (value === undefined || value <= 0) return "";
  return String(value);
}

function sumRecord(
  ids: string[],
  amounts: Record<string, number>,
  fallback?: Record<string, number>
): number {
  let total = 0;
  for (const id of ids) {
    const v = amounts[id];
    if (v !== undefined && v > 0) total += v;
    else if (fallback && (fallback[id] ?? 0) > 0) total += fallback[id];
  }
  return total;
}

/** What a debt needs this month: its fixed payment, capped at what's left to pay. */
function debtRequiredPayment(debt: Debt): number {
  return Math.min(debt.balance, Math.max(0, debt.monthlyPayment));
}

/** Debt row inputs: saved simulation value when present, else the debt's monthly payment. */
function debtAmountInputs(
  debts: Debt[],
  saved?: Record<string, number>
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const debt of debts) {
    const value = saved?.[debt.id];
    next[debt.id] = amountToInput(value !== undefined ? value : debtRequiredPayment(debt));
  }
  return next;
}

export default function SimulationPage() {
  const { loading: authLoading } = useRequireAuth();
  const { user } = useAuth();
  const { activeBookId, categories, currency, activeMonth } = useAppStore();
  const { t, locale } = useLocale();
  const confirm = useConfirm();
  const isRtl = locale === "he";
  const align = isRtl ? "text-right" : "text-left";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [whatIfCategories, setWhatIfCategories] = useState<SimulationWhatIfCategory[]>([]);
  const [whatIfAmounts, setWhatIfAmounts] = useState<Record<string, string>>({});
  const [recurringByCat, setRecurringByCat] = useState<Record<string, number>>({});
  const [prevByCat, setPrevByCat] = useState<Record<string, number>>({});
  const [avg3ByCat, setAvg3ByCat] = useState<Record<string, number>>({});
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtAmounts, setDebtAmounts] = useState<Record<string, string>>({});
  const [debtCategoryIds, setDebtCategoryIds] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<TransactionType>("expense");
  const [tab, setTab] = useState<"budget" | "payoff">("budget");

  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === "income").sort((a, b) => a.order - b.order),
    [categories]
  );
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === "expense").sort((a, b) => a.order - b.order),
    [categories]
  );

  const seedAmounts = useCallback(
    (
      cats: { id: string }[],
      recurring: Record<string, number>,
      prev: Record<string, number>,
      recurringOnlyIds: string[]
    ): Record<string, string> => {
      const next: Record<string, string> = {};
      for (const cat of cats) {
        const fromRec = recurring[cat.id] ?? 0;
        // Last month in these categories includes debt payments, which have their own rows.
        const fromPrev = recurringOnlyIds.includes(cat.id) ? 0 : (prev[cat.id] ?? 0);
        const seed = fromRec > 0 ? fromRec : fromPrev;
        if (seed > 0) next[cat.id] = String(Math.round(seed));
      }
      return next;
    },
    []
  );

  const load = useCallback(async () => {
    if (!user || !activeBookId) return;
    setLoading(true);
    try {
      const anchorMonth = activeMonth || getMonthKey(new Date());
      const prevKey = getPrevMonthKey(anchorMonth);
      const historyKeys = lookbackMonthKeys(prevKey, 3);
      const historyStartKey = historyKeys[0] ?? prevKey;
      const { start: historyStart } = getMonthRange(historyStartKey);
      const { end: prevEnd } = getMonthRange(prevKey);

      const [sim, recurrings, historyTxs, allDebts] = await Promise.all([
        getSimulation(user.uid, activeBookId),
        getRecurring(user.uid, activeBookId),
        getTransactionsByMonth(user.uid, activeBookId, historyStart, prevEnd),
        getDebts(user.uid, activeBookId),
      ]);

      const openDebts = sortDebtsByPayoffOrder(
        allDebts.filter((d) => d.status === "open" && d.balance > 0)
      );
      const debtRecurringIds = new Set(
        allDebts.map((d) => d.recurringId).filter((id): id is string => !!id)
      );

      // Debt payments get their own rows, so their auto recurrings stay out of the category totals.
      const recMap: Record<string, number> = {};
      const debtRecByCat: Record<string, number> = {};
      for (const r of recurrings.filter((x) => x.active)) {
        const monthly = toMonthlyRecurringAmount(r.amount, r.cadence);
        if (debtRecurringIds.has(r.id) || isAutoDebtRecurring(r)) {
          debtRecByCat[r.categoryId] = (debtRecByCat[r.categoryId] ?? 0) + monthly;
        } else {
          recMap[r.categoryId] = (recMap[r.categoryId] ?? 0) + monthly;
        }
      }
      const debtCats = Object.keys(debtRecByCat);

      const prevTxs = historyTxs.filter(
        (tx) => getMonthKey(tx.date.toDate()) === prevKey
      );
      const prevExpense = computeExpenseByCategory(prevTxs);
      const prevIncome = computeIncomeByCategory(prevTxs);
      const prevMap = { ...prevExpense, ...prevIncome };

      const avgExpense = averageExpenseByCategory(historyTxs, historyKeys);
      const avgIncome = averageIncomeByCategory(historyTxs, historyKeys);
      const avgMap = { ...avgExpense, ...avgIncome };

      setRecurringByCat(recMap);
      setPrevByCat(prevMap);
      setAvg3ByCat(avgMap);
      setDebts(openDebts);
      setDebtCategoryIds(debtCats);
      setDebtAmounts(debtAmountInputs(openDebts, sim?.debtAmounts));

      if (sim) {
        const amountInputs: Record<string, string> = {};
        for (const [id, value] of Object.entries(sim.amounts)) {
          amountInputs[id] = amountToInput(value);
        }
        if (!sim.debtAmounts) {
          // Sheets saved before debt rows had the debt recurrings seeded into their category.
          for (const [catId, debtMonthly] of Object.entries(debtRecByCat)) {
            const saved = sim.amounts[catId];
            if (saved === undefined) continue;
            amountInputs[catId] = amountToInput(Math.max(0, Math.round(saved - debtMonthly)));
          }
        }
        const whatIfInputs: Record<string, string> = {};
        for (const [id, value] of Object.entries(sim.whatIfAmounts)) {
          whatIfInputs[id] = amountToInput(value);
        }
        setAmounts(amountInputs);
        setWhatIfCategories(sim.whatIfCategories);
        setWhatIfAmounts(whatIfInputs);
      } else {
        const allCats = [
          ...categories.filter((c) => c.type === "income" || c.type === "expense"),
        ];
        setAmounts(seedAmounts(allCats, recMap, prevMap, debtCats));
        setWhatIfCategories([]);
        setWhatIfAmounts({});
      }
    } catch (err) {
      console.error(err);
      toast.error(t.simulation_load_error);
    } finally {
      setLoading(false);
    }
  }, [user, activeBookId, activeMonth, categories, seedAmounts, t.simulation_load_error]);

  useEffect(() => {
    void load();
  }, [load]);

  const parsedAmounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [id, value] of Object.entries(amounts)) {
      const n = parseAmount(value);
      if (n > 0) map[id] = n;
    }
    return map;
  }, [amounts]);

  const parsedWhatIfAmounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [id, value] of Object.entries(whatIfAmounts)) {
      const n = parseAmount(value);
      if (n > 0) map[id] = n;
    }
    return map;
  }, [whatIfAmounts]);

  const incomeIds = incomeCategories.map((c) => c.id);
  const expenseIds = expenseCategories.map((c) => c.id);
  const whatIfIncomeIds = whatIfCategories.filter((c) => c.type === "income").map((c) => c.id);
  const whatIfExpenseIds = whatIfCategories.filter((c) => c.type === "expense").map((c) => c.id);

  const parsedDebtAmounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const debt of debts) map[debt.id] = parseAmount(debtAmounts[debt.id] ?? "");
    return map;
  }, [debts, debtAmounts]);

  const simIncome =
    sumRecord(incomeIds, parsedAmounts) + sumRecord(whatIfIncomeIds, parsedWhatIfAmounts);
  const simOtherExpense =
    sumRecord(expenseIds, parsedAmounts) + sumRecord(whatIfExpenseIds, parsedWhatIfAmounts);
  const simDebt = Object.values(parsedDebtAmounts).reduce((s, v) => s + v, 0);
  const simExpense = simOtherExpense + simDebt;
  const simNet = simIncome - simExpense;

  const debtRequired = debts.reduce((s, d) => s + debtRequiredPayment(d), 0);
  const leftForDebts = simIncome - simOtherExpense;
  const debtCoverage = leftForDebts - debtRequired;
  const debtShortfallInSim = debtRequired - simDebt;

  const baselineIncome = (map: Record<string, number>) => sumRecord(incomeIds, map);
  const baselineExpense = (map: Record<string, number>) => sumRecord(expenseIds, map);

  const setAmount = (id: string, value: string) => {
    setAmounts((prev) => ({ ...prev, [id]: value }));
  };

  const setWhatIfAmount = (id: string, value: string) => {
    setWhatIfAmounts((prev) => ({ ...prev, [id]: value }));
  };

  const setDebtAmount = (id: string, value: string) => {
    setDebtAmounts((prev) => ({ ...prev, [id]: value }));
  };

  const handleFillDebts = () => {
    setDebtAmounts(debtAmountInputs(debts));
    toast.success(t.simulation_debts_filled);
  };

  const handleSave = async () => {
    if (!user || !activeBookId) return;
    setSaving(true);
    try {
      await saveSimulation(user.uid, activeBookId, {
        amounts: parsedAmounts,
        whatIfCategories,
        whatIfAmounts: parsedWhatIfAmounts,
        debtAmounts: parsedDebtAmounts,
      });
      toast.success(t.simulation_saved);
    } catch (err) {
      console.error(err);
      toast.error(t.simulation_save_error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: t.simulation_reset_confirm_title,
      message: t.simulation_reset_confirm,
      confirmLabel: t.simulation_reset,
      cancelLabel: t.simulation_cancel,
    });
    if (!ok) return;
    const allCats = [...incomeCategories, ...expenseCategories];
    setAmounts(seedAmounts(allCats, recurringByCat, prevByCat, debtCategoryIds));
    setDebtAmounts(debtAmountInputs(debts));
    setWhatIfCategories([]);
    setWhatIfAmounts({});
  };

  const handleAddWhatIf = () => {
    const name = newName.trim();
    if (!name) return;
    const id = `whatif_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    setWhatIfCategories((prev) => [...prev, { id, name, type: newType }]);
    setWhatIfAmounts((prev) => ({ ...prev, [id]: "" }));
    setNewName("");
    setNewType("expense");
    setAddOpen(false);
  };

  const handleRemoveWhatIf = (id: string) => {
    setWhatIfCategories((prev) => prev.filter((c) => c.id !== id));
    setWhatIfAmounts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  if (authLoading) return null;

  const formatCell = (value: number) =>
    value > 0 ? formatCurrency(value, currency) : "—";

  const renderRow = (opts: {
    key: string;
    label: React.ReactNode;
    recurring: number;
    prev: number;
    avg3: number;
    inputValue: string;
    onChange: (v: string) => void;
    trailing?: React.ReactNode;
    muted?: boolean;
  }) => (
    <div
      key={opts.key}
      className={cn(
        "flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center",
        opts.muted && "border-dashed bg-muted/30"
      )}
    >
      <div className={cn("flex min-w-0 flex-1 items-center gap-2", align)}>
        <div className="min-w-0 flex-1 font-medium text-sm truncate">{opts.label}</div>
        {opts.trailing}
      </div>
      <div className="w-full text-start text-xs tabular-nums text-muted-foreground sm:w-[90px] sm:shrink-0 sm:text-center">
        <span className={cn("sm:hidden me-1", align)}>{t.simulation_col_recurring}:</span>
        <span dir="ltr">{formatCell(opts.recurring)}</span>
      </div>
      <div className="w-full text-start text-xs tabular-nums text-muted-foreground sm:w-[90px] sm:shrink-0 sm:text-center">
        <span className={cn("sm:hidden me-1", align)}>{t.simulation_col_prev}:</span>
        <span dir="ltr">{formatCell(opts.prev)}</span>
      </div>
      <div className="w-full text-start text-xs tabular-nums text-muted-foreground sm:w-[90px] sm:shrink-0 sm:text-center">
        <span className={cn("sm:hidden me-1", align)}>{t.simulation_col_avg3}:</span>
        <span dir="ltr">{formatCell(opts.avg3)}</span>
      </div>
      <div className="w-full sm:w-[110px] sm:shrink-0">
        <Input
          type="number"
          min="0"
          step="1"
          inputMode="decimal"
          className="h-9 text-end tabular-nums"
          dir="ltr"
          value={opts.inputValue}
          onChange={(e) => opts.onChange(e.target.value)}
          placeholder="0"
        />
      </div>
    </div>
  );

  const renderColumnHeader = (firstCol: string) => (
    <div className="hidden sm:flex items-center gap-2 px-2 text-[11px] text-muted-foreground">
      <span className={cn("min-w-0 flex-1", align)}>{firstCol}</span>
      <span className="w-[90px] shrink-0 text-center">{t.simulation_col_recurring}</span>
      <span className="w-[90px] shrink-0 text-center">{t.simulation_col_prev}</span>
      <span className="w-[90px] shrink-0 text-center">{t.simulation_col_avg3}</span>
      <span className="w-[110px] shrink-0 text-center">{t.simulation_col_sim}</span>
    </div>
  );

  const renderDebtSection = () => (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 className={cn("text-sm font-semibold text-muted-foreground", align)}>
          {t.simulation_section_debts}
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={handleFillDebts}>
          <RefreshCw className="h-3.5 w-3.5 me-1" />
          {t.simulation_debts_fill}
        </Button>
      </div>
      <p className={cn("text-xs text-muted-foreground px-1", align)}>
        {t.simulation_debts_hint}{" "}
        <Link href="/debts" className="text-primary underline-offset-2 hover:underline">
          {t.payoff_manage_debts}
        </Link>
      </p>
      {renderColumnHeader(t.simulation_col_debt)}
      {debts.map((debt) =>
        renderRow({
          key: debt.id,
          label: (
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{debt.name}</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                {t.simulation_debt_balance.replace(
                  "{amount}",
                  formatCurrency(debt.balance, currency)
                )}
              </span>
            </span>
          ),
          recurring: debtRequiredPayment(debt),
          prev: 0,
          avg3: 0,
          inputValue: debtAmounts[debt.id] ?? "",
          onChange: (v) => setDebtAmount(debt.id, v),
        })
      )}
    </div>
  );

  const debtCoverageCard = (
    <Card
      className={cn(
        debtCoverage >= 0 ? "border-green-600/30" : "border-red-500/40"
      )}
    >
      <CardContent className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className={cn("space-y-0.5", align)}>
            <div className="text-[11px] text-muted-foreground">{t.simulation_debts_required}</div>
            <div className="text-lg font-semibold tabular-nums" dir="ltr">
              {formatCurrency(debtRequired, currency)}
            </div>
          </div>
          <div className={cn("space-y-0.5", align)} title={t.simulation_debts_available_hint}>
            <div className="text-[11px] text-muted-foreground">{t.simulation_debts_available}</div>
            <div
              className={cn(
                "text-lg font-semibold tabular-nums",
                debtCoverage >= 0 ? "text-green-600" : "text-red-500"
              )}
              dir="ltr"
            >
              {formatCurrency(leftForDebts, currency)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {t.simulation_debts_available_hint}
            </div>
          </div>
          <div
            className={cn(
              "col-span-2 flex items-start gap-2 text-sm sm:col-span-1",
              debtCoverage >= 0 ? "text-green-700" : "text-red-600"
            )}
          >
            {debtCoverage >= 0 ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span className={align}>
              {(debtCoverage >= 0
                ? t.simulation_debts_covered
                : t.simulation_debts_short
              ).replace("{amount}", formatCurrency(Math.abs(debtCoverage), currency))}
            </span>
          </div>
        </div>
        {debtShortfallInSim > 0.5 && (
          <p className={cn("flex items-start gap-2 text-xs text-amber-600", align)}>
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t.simulation_debts_below_required.replace(
              "{amount}",
              formatCurrency(debtShortfallInSim, currency)
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );

  const renderSection = (
    title: string,
    realCats: typeof incomeCategories,
    whatIfs: SimulationWhatIfCategory[]
  ) => (
    <div className="space-y-2">
      <h2 className={cn("text-sm font-semibold text-muted-foreground px-1", align)}>{title}</h2>
      {renderColumnHeader(t.simulation_col_category)}
      {realCats.map((cat) =>
        renderRow({
          key: cat.id,
          label: (
            <span className="inline-flex items-center gap-2 min-w-0">
              <span
                className="text-lg w-8 h-8 flex items-center justify-center rounded-md flex-shrink-0"
                style={{ backgroundColor: cat.color + "22" }}
              >
                {cat.icon}
              </span>
              <span className="truncate">{getCategoryDisplayName(cat, locale)}</span>
            </span>
          ),
          recurring: recurringByCat[cat.id] ?? 0,
          prev: prevByCat[cat.id] ?? 0,
          avg3: avg3ByCat[cat.id] ?? 0,
          inputValue: amounts[cat.id] ?? "",
          onChange: (v) => setAmount(cat.id, v),
        })
      )}
      {whatIfs.map((cat) =>
        renderRow({
          key: cat.id,
          label: (
            <span className="inline-flex items-center gap-2">
              <span className="truncate">{cat.name}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t.simulation_whatif_badge}
              </span>
            </span>
          ),
          recurring: 0,
          prev: 0,
          avg3: 0,
          inputValue: whatIfAmounts[cat.id] ?? "",
          onChange: (v) => setWhatIfAmount(cat.id, v),
          muted: true,
          trailing: (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => handleRemoveWhatIf(cat.id)}
              title={t.simulation_remove_whatif}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ),
        })
      )}
      {realCats.length === 0 && whatIfs.length === 0 && (
        <p className={cn("text-sm text-muted-foreground py-4 px-1", align)}>
          {t.simulation_no_categories}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", align)}>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">{t.simulation_title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.simulation_subtitle}</p>
        </div>
        {tab === "budget" && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 me-1" />
              {t.simulation_add_whatif}
            </Button>
            <Button type="button" variant="outline" onClick={() => void handleReset()}>
              <Eraser className="h-4 w-4 me-1" />
              {t.simulation_reset}
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving || loading}>
              <Save className="h-4 w-4 me-1" />
              {saving ? t.simulation_saving : t.simulation_save}
            </Button>
          </div>
        )}
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "budget" | "payoff")}
        dir={isRtl ? "rtl" : "ltr"}
      >
        <TabsList>
          <TabsTrigger value="budget">{t.simulation_tab_budget}</TabsTrigger>
          <TabsTrigger value="payoff">{t.simulation_tab_payoff}</TabsTrigger>
        </TabsList>

        <TabsContent value="payoff" forceMount className="mt-4 data-[state=inactive]:hidden">
          <DebtPayoffPanel budgetForDebts={leftForDebts} />
        </TabsContent>

        <TabsContent value="budget" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className={cn("text-base", align)}>{t.simulation_totals_title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={cn("space-y-0.5", align)}>
                  <div className="text-[11px] text-muted-foreground">{t.simulation_total_income}</div>
                  <div className="text-lg font-semibold tabular-nums text-green-600" dir="ltr">
                    {formatCurrency(simIncome, currency)}
                  </div>
                </div>
                <div className={cn("space-y-0.5", align)}>
                  <div className="text-[11px] text-muted-foreground">{t.simulation_total_expenses}</div>
                  <div className="text-lg font-semibold tabular-nums text-red-500" dir="ltr">
                    {formatCurrency(simExpense, currency)}
                  </div>
                </div>
                <div className={cn("space-y-0.5", align)}>
                  <div className="text-[11px] text-muted-foreground">{t.simulation_total_net}</div>
                  <div
                    className={cn(
                      "text-lg font-semibold tabular-nums",
                      simNet >= 0 ? "text-green-600" : "text-red-500"
                    )}
                    dir="ltr"
                  >
                    {formatCurrency(simNet, currency)}
                  </div>
                </div>
                <div className={cn("space-y-0.5 text-xs text-muted-foreground", align)}>
                  <div>
                    {t.simulation_col_recurring}:{" "}
                    <span dir="ltr" className="tabular-nums">
                      {formatCurrency(
                        baselineIncome(recurringByCat) -
                          baselineExpense(recurringByCat) -
                          debtRequired,
                        currency
                      )}
                    </span>
                  </div>
                  <div>
                    {t.simulation_col_prev}:{" "}
                    <span dir="ltr" className="tabular-nums">
                      {formatCurrency(baselineIncome(prevByCat) - baselineExpense(prevByCat), currency)}
                    </span>
                  </div>
                  <div>
                    {t.simulation_col_avg3}:{" "}
                    <span dir="ltr" className="tabular-nums">
                      {formatCurrency(baselineIncome(avg3ByCat) - baselineExpense(avg3ByCat), currency)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {!loading && debts.length > 0 && debtCoverageCard}

          {loading ? (
            <p className={cn("text-sm text-muted-foreground py-8", align)}>{t.simulation_loading}</p>
          ) : (
            <div className="space-y-8">
              {renderSection(
                t.simulation_section_income,
                incomeCategories,
                whatIfCategories.filter((c) => c.type === "income")
              )}
              {renderSection(
                t.simulation_section_expenses,
                expenseCategories,
                whatIfCategories.filter((c) => c.type === "expense")
              )}
              {debts.length > 0 && renderDebtSection()}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.simulation_add_whatif_title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>{t.simulation_whatif_name}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t.simulation_whatif_name_placeholder}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.simulation_whatif_type}</Label>
              <Select
                value={newType}
                onValueChange={(v) => setNewType(v as TransactionType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">{t.simulation_section_income}</SelectItem>
                  <SelectItem value="expense">{t.simulation_section_expenses}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">{t.simulation_whatif_hint}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              {t.simulation_cancel}
            </Button>
            <Button type="button" onClick={handleAddWhatIf} disabled={!newName.trim()}>
              {t.simulation_add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
