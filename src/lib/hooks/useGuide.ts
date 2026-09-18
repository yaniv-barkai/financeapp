"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { startOfDay, startOfMonth, subMonths } from "date-fns";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAppStore } from "@/lib/store";
import {
  evaluateGuide,
  findMismatchCategoryIds,
  isGuideBudgetComplete,
  monthKeysFromDates,
  type GuideResult,
} from "@/lib/guide/evaluate";
import {
  getGuideState,
  guideStateToSnoozeMap,
  markCategoriesReviewed,
  snoozeGuideItem,
} from "@/lib/firestore/guide";
import { getMonthlyBudget } from "@/lib/firestore/budgets";
import { getRecurring, toMonthlyRecurringAmount } from "@/lib/firestore/recurring";
import { getTransactionsByMonth } from "@/lib/firestore/transactions";
import { getTasks } from "@/lib/firestore/tasks";
import { getUserSettings } from "@/lib/firestore/settings";
import { computeExpenseByCategory } from "@/lib/budget";
import { GuideItemId } from "@/lib/types";
import { getMonthKey, getMonthRange, getNextMonthKey } from "@/lib/utils";

export function useGuide() {
  const { user } = useAuth();
  const { activeBookId, categories, txVersion } = useAppStore();
  const [result, setResult] = useState<GuideResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user || !activeBookId) {
        setResult(null);
        return;
      }
      setLoading(true);
      try {
        const now = new Date();
        const monthKey = getMonthKey(now);
        const nextMonthKey = getNextMonthKey(monthKey);
        const historyStart = startOfMonth(subMonths(now, 2));
        const { start: monthStart, end: monthEnd } = getMonthRange(monthKey);

        const [
          guideState,
          settings,
          recurrings,
          historyTxs,
          monthTxs,
          tasks,
          currentBudget,
          nextBudget,
        ] = await Promise.all([
          getGuideState(user.uid, activeBookId),
          getUserSettings(user.uid),
          getRecurring(user.uid, activeBookId),
          getTransactionsByMonth(user.uid, activeBookId, historyStart, monthEnd),
          getTransactionsByMonth(user.uid, activeBookId, monthStart, monthEnd),
          getTasks(user.uid, activeBookId),
          getMonthlyBudget(user.uid, activeBookId, monthKey),
          getMonthlyBudget(user.uid, activeBookId, nextMonthKey),
        ]);

        if (cancelled) return;

        const recurringByCat: Record<string, number> = {};
        let hasActiveExpenseRecurring = false;
        let monthlyIncome = 0;
        for (const r of recurrings.filter((x) => x.active)) {
          const monthly = toMonthlyRecurringAmount(r.amount, r.cadence);
          if (r.type === "expense") {
            hasActiveExpenseRecurring = true;
            recurringByCat[r.categoryId] =
              (recurringByCat[r.categoryId] ?? 0) + monthly;
          } else if (r.type === "income") {
            monthlyIncome += monthly;
          }
        }

        const spentByCat = computeExpenseByCategory(monthTxs);
        const budgetAmounts = currentBudget?.amounts ?? {};
        const expenseIds = categories
          .filter((c) => c.type === "expense")
          .map((c) => c.id);
        const mismatchCategoryIds = findMismatchCategoryIds(
          expenseIds,
          spentByCat,
          budgetAmounts,
          recurringByCat
        );
        const currentSet = isGuideBudgetComplete(currentBudget?.amounts, monthlyIncome);
        const nextSet = isGuideBudgetComplete(nextBudget?.amounts, monthlyIncome);

        const transactionMonthKeys = monthKeysFromDates(
          historyTxs.map((tx) => tx.date.toDate())
        );

        let recentActivityAt: Date | null = null;
        for (const tx of historyTxs) {
          const created = tx.createdAt?.toDate?.();
          if (created && (!recentActivityAt || created > recentActivityAt)) {
            recentActivityAt = created;
          }
        }
        const maxSyncAt = settings?.maxSync?.lastSyncAt?.toDate?.() ?? null;
        if (maxSyncAt && (!recentActivityAt || maxSyncAt > recentActivityAt)) {
          recentActivityAt = maxSyncAt;
        }

        const todayStart = startOfDay(now);
        const overdueTaskCount = tasks.filter((task) => {
          if (task.status !== "open") return false;
          const end = task.endDate?.toDate?.();
          return end ? end < todayStart : false;
        }).length;

        const categoriesReviewedAt =
          guideState.categoriesReviewedAt?.toDate?.() ?? null;

        setResult(
          evaluateGuide({
            now,
            categories,
            categoriesReviewedAt,
            transactionMonthKeys,
            recentActivityAt,
            hasActiveExpenseRecurring,
            currentBudgetSet: currentSet,
            nextBudgetSet: nextSet,
            mismatchCategoryIds,
            overdueTaskCount,
            snoozedUntil: guideStateToSnoozeMap(guideState),
          })
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user, activeBookId, categories, txVersion, version]);

  const confirmCategories = useCallback(async () => {
    if (!user || !activeBookId) return;
    await markCategoriesReviewed(user.uid, activeBookId);
    refresh();
  }, [user, activeBookId, refresh]);

  const snooze = useCallback(
    async (itemId: GuideItemId) => {
      if (!user || !activeBookId) return;
      await snoozeGuideItem(user.uid, activeBookId, itemId);
      refresh();
    },
    [user, activeBookId, refresh]
  );

  return useMemo(
    () => ({
      result,
      loading,
      refresh,
      confirmCategories,
      snooze,
    }),
    [result, loading, refresh, confirmCategories, snooze]
  );
}
