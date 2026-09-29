"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Eraser,
  Sparkles,
  Save,
  TrendingUp,
  TrendingDown,
  Wallet,
  X,
} from "lucide-react";
import { addMonths, subMonths } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useAppStore } from "@/lib/store";
import {
  getBudgetEditorSeed,
  saveMonthlyBudget,
} from "@/lib/firestore/budgets";
import { getRecurring, toMonthlyRecurringAmount } from "@/lib/firestore/recurring";
import { getSimulation } from "@/lib/firestore/simulations";
import {
  getTransactionsByMonth,
  updateTransaction,
} from "@/lib/firestore/transactions";
import { upsertMerchant } from "@/lib/firestore/merchants";
import {
  averageExpenseByCategory,
  averageIncomeByCategory,
  cleanedBudgetAmounts,
  computeExpenseByCategory,
  computeIncomeByCategory,
  lookbackMonthKeys,
} from "@/lib/budget";
import { getIdToken } from "@/lib/auth-token";
import { Category, Transaction } from "@/lib/types";
import {
  cn,
  formatCurrency,
  formatInstallmentLabel,
  getCategoryDisplayName,
  getMonthKey,
  getMonthRange,
  getPrevMonthKey,
  parseMonthKey,
} from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { TransactionCategoryControls } from "@/components/transactions/TransactionCategoryControls";

interface SuggestItem {
  catId: string;
  name: string;
  currentBudget: number;
  suggestedBudget: number;
  /** Positive = add budget, negative = free up budget */
  delta: number;
  reason: string;
}

function toInputs(
  cats: Category[],
  values: Record<string, number>
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const cat of cats) {
    const v = values[cat.id];
    next[cat.id] = v !== undefined && v > 0 ? String(v) : "";
  }
  return next;
}

function roundedAmounts(values: Record<string, number>): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [id, v] of Object.entries(values)) next[id] = Math.round(v);
  return next;
}

function parseInputs(inputs: Record<string, string>): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [catId, raw] of Object.entries(inputs)) {
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0) map[catId] = n;
  }
  return map;
}

export function MonthlyBudgetEditor() {
  const { user } = useAuth();
  const { activeBookId, categories, currency, setMerchants } = useAppStore();
  const bumpTxVersion = useAppStore((s) => s.bumpTxVersion);
  const { t, locale } = useLocale();
  const isRtl = locale === "he";

  const [budgetMonth, setBudgetMonth] = useState(() => getMonthKey(new Date()));
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [incomeAmounts, setIncomeAmounts] = useState<Record<string, string>>({});
  const [recurringByCat, setRecurringByCat] = useState<Record<string, number>>({});
  const [recurringIncomeByCat, setRecurringIncomeByCat] = useState<Record<string, number>>({});
  const [prevSpent, setPrevSpent] = useState<Record<string, number>>({});
  const [avg3Spent, setAvg3Spent] = useState<Record<string, number>>({});
  const [currentSpent, setCurrentSpent] = useState<Record<string, number>>({});
  const [prevIncome, setPrevIncome] = useState<Record<string, number>>({});
  const [avg3Income, setAvg3Income] = useState<Record<string, number>>({});
  const [currentIncome, setCurrentIncome] = useState<Record<string, number>>({});
  const [copyingSim, setCopyingSim] = useState(false);
  const [monthTxs, setMonthTxs] = useState<Transaction[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isSet, setIsSet] = useState(false);
  const [seededFrom, setSeededFrom] = useState<"month" | "previous" | "legacy" | "none">("none");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestItem[] | null>(null);
  const [suggestSummary, setSuggestSummary] = useState("");

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === "expense").sort((a, b) => a.order - b.order),
    [categories]
  );
  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === "income").sort((a, b) => a.order - b.order),
    [categories]
  );

  const date = parseMonthKey(budgetMonth);
  const monthLabel = new Intl.DateTimeFormat(isRtl ? "he-IL" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
  const currentKey = getMonthKey(new Date());
  const maxKey = getMonthKey(addMonths(new Date(), 1));
  const canGoNext = budgetMonth < maxKey;
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  const load = async () => {
    if (!user || !activeBookId) return;
    setLoading(true);
    try {
      const prevKey = getPrevMonthKey(budgetMonth);
      const historyKeys = lookbackMonthKeys(prevKey, 3);
      const historyStartKey = historyKeys[0] ?? prevKey;
      const { start: historyStart } = getMonthRange(historyStartKey);
      const { end: prevEnd } = getMonthRange(prevKey);
      const { start, end } = getMonthRange(budgetMonth);

      const [seed, recurrings, historyTxs, monthTransactions] = await Promise.all([
        getBudgetEditorSeed(user.uid, activeBookId, budgetMonth, categories),
        getRecurring(user.uid, activeBookId),
        getTransactionsByMonth(user.uid, activeBookId, historyStart, prevEnd),
        getTransactionsByMonth(user.uid, activeBookId, start, end),
      ]);

      const recMap: Record<string, number> = {};
      const recIncomeMap: Record<string, number> = {};
      for (const r of recurrings.filter((x) => x.active)) {
        const monthly = toMonthlyRecurringAmount(r.amount, r.cadence);
        if (r.type === "expense") {
          recMap[r.categoryId] = (recMap[r.categoryId] ?? 0) + monthly;
        } else if (r.type === "income") {
          recIncomeMap[r.categoryId] = (recIncomeMap[r.categoryId] ?? 0) + monthly;
        }
      }
      setRecurringByCat(recMap);
      setRecurringIncomeByCat(recIncomeMap);

      const prevTxs = historyTxs.filter(
        (tx) => getMonthKey(tx.date.toDate()) === prevKey
      );
      setPrevSpent(computeExpenseByCategory(prevTxs));
      setAvg3Spent(averageExpenseByCategory(historyTxs, historyKeys));
      setPrevIncome(computeIncomeByCategory(prevTxs));
      setAvg3Income(averageIncomeByCategory(historyTxs, historyKeys));
      setMonthTxs(monthTransactions);
      setCurrentSpent(computeExpenseByCategory(monthTransactions));
      setCurrentIncome(computeIncomeByCategory(monthTransactions));
      setIsSet(seed.isSet);
      setSeededFrom(seed.seededFrom);

      setAmounts(toInputs(expenseCategories, seed.amounts));
      // Budgets saved before per-category income start from recurring income.
      setIncomeAmounts(
        toInputs(
          incomeCategories,
          seed.incomeAmounts ?? roundedAmounts(recIncomeMap)
        )
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedCategoryId(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeBookId, budgetMonth, categories.length]);

  const parsedAmounts = useMemo(() => parseInputs(amounts), [amounts]);
  const parsedIncomeAmounts = useMemo(() => parseInputs(incomeAmounts), [incomeAmounts]);

  const monthlyIncome = useMemo(
    () => Object.values(parsedIncomeAmounts).reduce((s, v) => s + v, 0),
    [parsedIncomeAmounts]
  );

  const totalBudget = useMemo(
    () => Object.values(parsedAmounts).reduce((s, v) => s + v, 0),
    [parsedAmounts]
  );

  const totalSpent = useMemo(
    () => Object.values(currentSpent).reduce((s, v) => s + v, 0),
    [currentSpent]
  );

  const budgetLeft = monthlyIncome - totalBudget;

  const txCountByCat = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of monthTxs) {
      map[tx.categoryId] = (map[tx.categoryId] ?? 0) + 1;
    }
    return map;
  }, [monthTxs]);

  const selectedCategory = useMemo(
    () =>
      selectedCategoryId
        ? categories.find((c) => c.id === selectedCategoryId) ?? null
        : null,
    [categories, selectedCategoryId]
  );

  const categoryTransactions = useMemo(() => {
    if (!selectedCategoryId) return [];
    return monthTxs
      .filter((tx) => tx.categoryId === selectedCategoryId)
      .sort((a, b) => b.date.toMillis() - a.date.toMillis());
  }, [monthTxs, selectedCategoryId]);

  const selectedIsIncome = selectedCategory?.type === "income";

  const categoryTotal = useMemo(
    () =>
      categoryTransactions.reduce(
        (s, tx) =>
          s + ((tx.type === "income") === selectedIsIncome ? tx.amount : -tx.amount),
        0
      ),
    [categoryTransactions, selectedIsIncome]
  );

  const handleCategoryChange = async (tx: Transaction, categoryId: string) => {
    if (!user || !activeBookId || categoryId === tx.categoryId) return;
    setMonthTxs((prev) => {
      const next = prev.map((t) => (t.id === tx.id ? { ...t, categoryId } : t));
      setCurrentSpent(computeExpenseByCategory(next));
      setCurrentIncome(computeIncomeByCategory(next));
      return next;
    });
    await updateTransaction(user.uid, activeBookId, tx.id, { categoryId });
    if (tx.merchantDisplay) {
      await upsertMerchant(user.uid, activeBookId, tx.merchantDisplay, categoryId);
      const { getMerchants } = await import("@/lib/firestore/merchants");
      const updated = await getMerchants(user.uid, activeBookId);
      setMerchants(updated);
    }
    bumpTxVersion();
  };

  const handleSave = async () => {
    if (!user || !activeBookId) return;
    setSaving(true);
    try {
      await saveMonthlyBudget(
        user.uid,
        activeBookId,
        budgetMonth,
        parsedAmounts,
        parsedIncomeAmounts
      );
      setIsSet(true);
      setSeededFrom("month");
      bumpTxVersion();
      if (budgetLeft < 0) {
        toast.warning(t.monthly_budget_over_income);
      } else {
        toast.success(t.monthly_budget_saved);
      }
    } catch {
      toast.error(t.monthly_budget_save_error);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyFromSimulation = async () => {
    if (!user || !activeBookId) return;
    setCopyingSim(true);
    try {
      const sim = await getSimulation(user.uid, activeBookId);
      if (!sim) {
        toast.info(t.monthly_budget_copy_sim_empty);
        return;
      }
      setAmounts(toInputs(expenseCategories, sim.amounts));
      setIncomeAmounts(toInputs(incomeCategories, sim.amounts));
      toast.success(t.monthly_budget_copy_sim_done);
      const skippedWhatIfs = sim.whatIfCategories.filter(
        (c) => (sim.whatIfAmounts[c.id] ?? 0) > 0
      ).length;
      if (skippedWhatIfs > 0) {
        toast.info(
          t.monthly_budget_copy_sim_whatif.replace("{count}", String(skippedWhatIfs))
        );
      }
    } catch {
      toast.error(t.monthly_budget_copy_sim_error);
    } finally {
      setCopyingSim(false);
    }
  };

  const handleSuggest = async () => {
    if (!user || !activeBookId) return;
    setSuggesting(true);
    try {
      const idToken = await getIdToken();
      if (!idToken) {
        toast.error(t.monthly_budget_suggest_error);
        return;
      }

      const seenCat = new Set<string>();
      const payload = {
        monthKey: budgetMonth,
        currency,
        locale,
        monthlyIncome,
        categories: expenseCategories.flatMap((cat) => {
          if (seenCat.has(cat.id)) return [];
          seenCat.add(cat.id);
          return [
            {
              id: cat.id,
              name: getCategoryDisplayName(cat, locale),
              budget: parsedAmounts[cat.id] ?? 0,
              spent: currentSpent[cat.id] ?? 0,
              recurring: recurringByCat[cat.id] ?? 0,
              prevMonthSpent: prevSpent[cat.id] ?? 0,
            },
          ];
        }),
      };

      const res = await fetch("/api/budget-suggest", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        toast.error(t.monthly_budget_suggest_error);
        return;
      }

      const data = (await res.json()) as {
        summary: string;
        suggestions: SuggestItem[];
      };
      setSuggestSummary(data.summary ?? "");
      // Dedupe by category — keep the last suggestion for each catId
      const byCat = new Map<string, SuggestItem>();
      for (const s of data.suggestions ?? []) {
        if (!s?.catId) continue;
        byCat.set(s.catId, {
          ...s,
          suggestedBudget: Math.round(s.suggestedBudget),
          delta: Math.round(s.suggestedBudget - s.currentBudget),
        });
      }
      const sorted = [...byCat.values()].sort((a, b) => b.delta - a.delta);
      setSuggestions(sorted);
    } catch {
      toast.error(t.monthly_budget_suggest_error);
    } finally {
      setSuggesting(false);
    }
  };

  const applySuggestions = () => {
    if (!suggestions?.length) return;
    setAmounts((prev) => {
      const next = { ...prev };
      for (const s of suggestions) {
        if (s.suggestedBudget > 0) {
          next[s.catId] = String(Math.round(s.suggestedBudget));
        } else {
          next[s.catId] = "";
        }
      }
      return next;
    });
    setSuggestions(null);
    toast.success(t.monthly_budget_suggest_applied);
  };

  const handleCleanup = () => {
    const cleaned = cleanedBudgetAmounts(
      expenseCategories.map((c) => c.id),
      recurringByCat
    );
    const next: Record<string, string> = {};
    for (const cat of expenseCategories) {
      const v = cleaned[cat.id];
      next[cat.id] = v !== undefined && v > 0 ? String(v) : "";
    }
    setAmounts(next);
    toast.success(t.monthly_budget_cleanup_applied);
  };

  const removeSuggestion = (catId: string) => {
    setSuggestions((prev) => {
      if (!prev) return prev;
      const next = prev.filter((s) => s.catId !== catId);
      return next;
    });
  };

  const updateSuggestionAmount = (catId: string, raw: string) => {
    setSuggestions((prev) => {
      if (!prev) return prev;
      return prev.map((s) => {
        if (s.catId !== catId) return s;
        const n = parseFloat(raw);
        const suggestedBudget = !isNaN(n) && n >= 0 ? Math.round(n) : 0;
        return {
          ...s,
          suggestedBudget,
          delta: suggestedBudget - s.currentBudget,
        };
      });
    });
  };

  const seedHint =
    !isSet && seededFrom === "previous"
      ? t.monthly_budget_seeded_previous
      : !isSet && seededFrom === "legacy"
        ? t.monthly_budget_seeded_legacy
        : !isSet
          ? t.monthly_budget_not_set
          : null;

  const align = isRtl ? "text-right" : "text-left";

  const renderSectionHeader = (title: string) => (
    <>
      <h3 className={cn("text-sm font-semibold text-muted-foreground px-1", align)}>{title}</h3>
      <div className="hidden sm:flex items-center gap-2 px-2 text-[11px] text-muted-foreground">
        <span className={cn("min-w-0 flex-1", align)}>{t.monthly_budget_col_category}</span>
        <span className="w-[90px] shrink-0 text-center">{t.monthly_budget_col_recurring}</span>
        <span className="w-[90px] shrink-0 text-center">{t.monthly_budget_col_prev}</span>
        <span className="w-[90px] shrink-0 text-center">{t.monthly_budget_col_avg3}</span>
        <span className="w-[110px] shrink-0 text-center">{t.monthly_budget_col_budget}</span>
      </div>
    </>
  );

  const renderCategoryRow = (cat: Category, isIncome: boolean) => {
    const rec = (isIncome ? recurringIncomeByCat : recurringByCat)[cat.id] ?? 0;
    const prev = (isIncome ? prevIncome : prevSpent)[cat.id] ?? 0;
    const avg3 = (isIncome ? avg3Income : avg3Spent)[cat.id] ?? 0;
    const actual = (isIncome ? currentIncome : currentSpent)[cat.id] ?? 0;
    const budget = (isIncome ? parsedIncomeAmounts : parsedAmounts)[cat.id] ?? 0;
    const inputs = isIncome ? incomeAmounts : amounts;
    const setInputs = isIncome ? setIncomeAmounts : setAmounts;
    const over = !isIncome && budget > 0 && actual > budget;
    const belowRecurring = !isIncome && rec > 0 && budget < rec;
    const txCount = txCountByCat[cat.id] ?? 0;
    return (
      <div
        key={cat.id}
        className={cn(
          "flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center",
          belowRecurring && "border-red-400 bg-red-50/60 dark:bg-red-950/25",
          !belowRecurring && over && "border-red-300 bg-red-50/50 dark:bg-red-950/20"
        )}
      >
        <button
          type="button"
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-md -ms-1 ps-1 pe-2 py-1 text-start",
            "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          onClick={() => setSelectedCategoryId(cat.id)}
        >
          <span
            className="text-lg w-8 h-8 flex items-center justify-center rounded-md flex-shrink-0"
            style={{ backgroundColor: cat.color + "22" }}
          >
            {cat.icon}
          </span>
          <div className={cn("min-w-0", align)}>
            <div className="font-medium text-sm truncate">
              {getCategoryDisplayName(cat, locale)}
            </div>
            {(budget > 0 || actual > 0) && (
              <div className="text-[11px] text-muted-foreground">
                {isIncome ? t.monthly_budget_received : t.monthly_budget_spent}:{" "}
                <span dir="ltr" className="tabular-nums">
                  {formatCurrency(actual, currency)}
                </span>
                {txCount > 0 && (
                  <span className="ms-1">
                    · {t.monthly_budget_tx_count.replace("{count}", String(txCount))}
                  </span>
                )}
                {over && (
                  <span className="text-red-600 ms-1">
                    ({t.dashboard_budget_over}{" "}
                    <span dir="ltr">{formatCurrency(actual - budget, currency)}</span>)
                  </span>
                )}
              </div>
            )}
            {belowRecurring && (
              <div className="text-[11px] text-red-600">
                {t.monthly_budget_below_recurring}
              </div>
            )}
          </div>
        </button>
        <div className="w-full text-start text-xs tabular-nums text-muted-foreground sm:w-[90px] sm:shrink-0 sm:text-center">
          <span className={cn("sm:hidden text-muted-foreground me-1", align)}>
            {t.monthly_budget_col_recurring}:
          </span>
          <span dir="ltr" className="inline-block">
            {rec > 0 ? formatCurrency(rec, currency) : "—"}
          </span>
        </div>
        <div className="w-full text-start text-xs tabular-nums text-muted-foreground sm:w-[90px] sm:shrink-0 sm:text-center">
          <span className={cn("sm:hidden text-muted-foreground me-1", align)}>
            {t.monthly_budget_col_prev}:
          </span>
          <span dir="ltr" className="inline-block">
            {prev > 0 ? formatCurrency(prev, currency) : "—"}
          </span>
        </div>
        <div className="w-full text-start text-xs tabular-nums text-muted-foreground sm:w-[90px] sm:shrink-0 sm:text-center">
          <span className={cn("sm:hidden text-muted-foreground me-1", align)}>
            {t.monthly_budget_col_avg3}:
          </span>
          <span dir="ltr" className="inline-block">
            {avg3 > 0 ? formatCurrency(avg3, currency) : "—"}
          </span>
        </div>
        <Input
          type="number"
          min="0"
          step="10"
          inputMode="decimal"
          className={cn(
            "h-8 w-full text-sm tabular-nums sm:w-[110px] sm:shrink-0",
            isRtl && "text-right",
            isIncome && "text-green-600",
            belowRecurring && "border-red-500 text-red-700 focus-visible:ring-red-500"
          )}
          placeholder="0"
          value={inputs[cat.id] ?? ""}
          onChange={(e) =>
            setInputs((prevAmt) => ({ ...prevAmt, [cat.id]: e.target.value }))
          }
          aria-label={getCategoryDisplayName(cat, locale)}
          dir="ltr"
        />
      </div>
    );
  };

  return (
    <Card dir={isRtl ? "rtl" : "ltr"}>
      <CardHeader className="pb-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className={cn("text-base", align)}>
            {t.monthly_budget_title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setBudgetMonth(getMonthKey(subMonths(date, 1)))}
            >
              <PrevIcon className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-sm min-w-[120px] text-center">{monthLabel}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!canGoNext}
              onClick={() => setBudgetMonth(getMonthKey(addMonths(date, 1)))}
            >
              <NextIcon className="h-4 w-4" />
            </Button>
            {budgetMonth !== currentKey && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setBudgetMonth(currentKey)}
              >
                {t.month_today}
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={cn("text-sm text-muted-foreground", align)}>
            {seedHint && <span>{seedHint}</span>}
          </div>
          <div className={cn("flex flex-wrap gap-2", isRtl && "order-first")}>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleCopyFromSimulation}
              disabled={copyingSim || loading}
            >
              <Copy className="h-3.5 w-3.5" />
              {t.monthly_budget_copy_sim}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleCleanup}
              disabled={loading || expenseCategories.length === 0}
            >
              <Eraser className="h-3.5 w-3.5" />
              {t.monthly_budget_cleanup}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleSuggest}
              disabled={suggesting || loading || totalBudget <= 0}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {suggesting ? t.monthly_budget_suggesting : t.monthly_budget_suggest}
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving || loading}>
              <Save className="h-3.5 w-3.5" />
              {saving ? t.categories_saving : t.monthly_budget_save}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Sticky live summary — stays visible while editing category amounts */}
      <div
        className={cn(
          "sticky top-14 z-20 border-y bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-4 py-3",
          budgetLeft < 0 && "bg-red-50/80 border-red-200 dark:bg-red-950/30 dark:border-red-900"
        )}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex flex-col gap-0.5 items-start">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-green-500" />
              {t.monthly_budget_income}
            </span>
            <span className="text-base font-semibold text-green-600 tabular-nums" dir="ltr">
              {formatCurrency(monthlyIncome, currency)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {t.monthly_budget_income_total_hint}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 items-start">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <TrendingDown className="h-3 w-3 text-red-500" />
              {t.monthly_budget_total}
            </span>
            <span className="text-base font-semibold text-red-500 tabular-nums" dir="ltr">
              {formatCurrency(totalBudget, currency)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 items-start">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Wallet className="h-3 w-3" />
              {t.monthly_budget_left}
            </span>
            <span
              className={cn(
                "text-base font-semibold tabular-nums",
                budgetLeft >= 0 ? "text-green-600" : "text-red-500"
              )}
              dir="ltr"
            >
              {formatCurrency(budgetLeft, currency)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 items-start">
            <span className="text-[11px] text-muted-foreground">{t.monthly_budget_spent}</span>
            <span className="text-base font-semibold tabular-nums text-foreground" dir="ltr">
              {formatCurrency(totalSpent, currency)}
            </span>
          </div>
        </div>
        {budgetLeft < 0 && (
          <p className={cn("mt-2 text-xs text-red-600", align)}>
            {t.monthly_budget_over_income}
          </p>
        )}
      </div>

      <CardContent className="pt-4">
        {loading ? (
          <p className={cn("text-sm text-muted-foreground py-6", align)}>{t.monthly_budget_loading}</p>
        ) : expenseCategories.length === 0 && incomeCategories.length === 0 ? (
          <p className={cn("text-sm text-muted-foreground py-6", align)}>{t.categories_no_categories}</p>
        ) : (
          <div className="space-y-6">
            {incomeCategories.length > 0 && (
              <div className="space-y-2">
                {renderSectionHeader(t.monthly_budget_section_income)}
                {incomeCategories.map((cat) => renderCategoryRow(cat, true))}
              </div>
            )}
            {expenseCategories.length > 0 && (
              <div className="space-y-2">
                {renderSectionHeader(t.monthly_budget_section_expenses)}
                {expenseCategories.map((cat) => renderCategoryRow(cat, false))}
              </div>
            )}
          </div>
        )}
      </CardContent>
      <Dialog
        open={!!selectedCategoryId}
        onOpenChange={(o) => !o && setSelectedCategoryId(null)}
      >
        <DialogContent
          className="sm:max-w-md max-h-[90vh] overflow-y-auto"
          dir={isRtl ? "rtl" : "ltr"}
        >
          <DialogHeader>
            <DialogTitle className={cn("flex items-center gap-2", align)}>
              {selectedCategory && (
                <>
                  <span className="text-xl" style={{ color: selectedCategory.color }}>
                    {selectedCategory.icon ?? "📦"}
                  </span>
                  <span>{getCategoryDisplayName(selectedCategory, locale)}</span>
                </>
              )}
            </DialogTitle>
            {selectedCategory && categoryTransactions.length > 0 && (
              <p
                className={cn(
                  "text-sm tabular-nums",
                  selectedIsIncome ? "text-green-600" : "text-red-500",
                  align
                )}
                dir="ltr"
              >
                {selectedIsIncome ? "+" : "−"}
                {formatCurrency(categoryTotal, currency)}
                <span className="text-muted-foreground ms-2">
                  · {t.monthly_budget_tx_count.replace("{count}", String(categoryTransactions.length))}
                </span>
              </p>
            )}
          </DialogHeader>
          <div className="space-y-1 divide-y">
            {categoryTransactions.map((tx) => {
              const cat = categories.find((c) => c.id === tx.categoryId);
              const catLabel = cat ? getCategoryDisplayName(cat, locale) : "—";
              return (
                <div key={tx.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                  <TransactionCategoryControls
                    tx={tx}
                    catIcon={cat?.icon ?? "📦"}
                    catLabel={catLabel}
                    onChange={(id) => handleCategoryChange(tx, id)}
                    note={tx.note}
                    installmentLabel={formatInstallmentLabel(
                      t.form_installment,
                      tx.installments
                    )}
                  />
                  <span
                    className={`font-semibold text-sm flex-shrink-0 ${
                      tx.type === "income" ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {tx.type === "income" ? "+" : "−"}
                    {formatCurrency(tx.amount, currency)}
                  </span>
                </div>
              );
            })}
            {categoryTransactions.length === 0 && (
              <p className={cn("text-center text-muted-foreground text-sm py-6", align)}>
                {t.monthly_budget_no_transactions}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!suggestions} onOpenChange={(o) => !o && setSuggestions(null)}>
        <DialogContent className="sm:max-w-md" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className={align}>{t.monthly_budget_suggest_title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {suggestSummary && (
              <p className={cn("text-sm text-muted-foreground", align)}>
                {suggestSummary}
              </p>
            )}
            {(suggestions ?? []).map((s) => (
              <div
                key={s.catId}
                className={cn("rounded-lg border p-3 space-y-2", align)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm min-w-0">{s.name}</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSuggestion(s.catId)}
                    title={t.monthly_budget_suggest_remove}
                    aria-label={t.monthly_budget_suggest_remove}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs tabular-nums text-muted-foreground" dir="ltr">
                    {formatCurrency(s.currentBudget, currency)} →
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="10"
                    inputMode="decimal"
                    className="h-8 w-[110px] text-sm tabular-nums"
                    value={s.suggestedBudget || ""}
                    onChange={(e) => updateSuggestionAmount(s.catId, e.target.value)}
                    aria-label={t.monthly_budget_suggest_amount}
                    dir="ltr"
                  />
                  {s.delta !== 0 && (
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        s.delta > 0 ? "text-green-600" : "text-amber-600"
                      )}
                      dir="ltr"
                    >
                      ({s.delta > 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(s.delta), currency)})
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{s.reason}</p>
              </div>
            ))}
            {!suggestions?.length && (
              <p className={cn("text-sm text-muted-foreground", align)}>
                {t.monthly_budget_suggest_empty}
              </p>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:items-center">
            {!!suggestions?.length && (
              <span className={cn("text-xs text-muted-foreground me-auto", align)}>
                {t.monthly_budget_suggest_kept.replace("{count}", String(suggestions.length))}
              </span>
            )}
            <Button variant="outline" onClick={() => setSuggestions(null)}>
              {t.categories_cancel}
            </Button>
            <Button onClick={applySuggestions} disabled={!suggestions?.length}>
              {t.monthly_budget_suggest_apply}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
