import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from "@/lib/seeds";
import { GuideItem, GuideItemId, GuideNavHref } from "@/lib/types";
import { daysUntilMonthEnd, getMonthKey } from "@/lib/utils";

export const GUIDE_NEXT_BUDGET_DAYS = 7;
export const GUIDE_WEEKLY_DAYS = 7;
export const GUIDE_SNOOZE_DAYS = 7;
export const GUIDE_SETUP_EMAIL_MIN_ACCOUNT_DAYS = 3;

export interface GuideCategoryLike {
  id: string;
  name: string;
  type: "income" | "expense";
}

export interface GuideEvaluateInput {
  now: Date;
  categories: GuideCategoryLike[];
  /** Explicit confirm on categories page */
  categoriesReviewedAt: Date | null;
  /** Distinct calendar months that have at least one transaction */
  transactionMonthKeys: string[];
  /** Latest of tx.createdAt / maxSync.lastSyncAt (activity signal) */
  recentActivityAt: Date | null;
  hasActiveExpenseRecurring: boolean;
  currentBudgetSet: boolean;
  nextBudgetSet: boolean;
  mismatchCategoryIds: string[];
  overdueTaskCount: number;
  /** Guide item id → snooze-until */
  snoozedUntil: Record<string, Date>;
}

export interface GuideResult {
  setup: GuideItem[];
  habits: GuideItem[];
  /** First incomplete setup item, else highest-severity habit, else null */
  primary: GuideItem | null;
  badgeCount: number;
  navDots: Partial<Record<Exclude<GuideNavHref, "/">, true>>;
  setupComplete: boolean;
  allItems: GuideItem[];
}

const SEED_KEYS = new Set(
  [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES].map(
    (c) => `${c.type}:${c.name}`
  )
);

/** True when categories differ from the default seed set (add/edit/delete). */
export function categoriesAreCustomized(categories: GuideCategoryLike[]): boolean {
  if (categories.length !== SEED_KEYS.size) return true;
  const actual = new Set(categories.map((c) => `${c.type}:${c.name}`));
  if (actual.size !== SEED_KEYS.size) return true;
  for (const key of SEED_KEYS) {
    if (!actual.has(key)) return true;
  }
  return false;
}

export function isCategoriesStepDone(
  categories: GuideCategoryLike[],
  categoriesReviewedAt: Date | null
): boolean {
  return Boolean(categoriesReviewedAt) || categoriesAreCustomized(categories);
}

function isSnoozed(
  id: GuideItemId,
  snoozedUntil: Record<string, Date>,
  now: Date
): boolean {
  const until = snoozedUntil[id];
  return Boolean(until && until.getTime() > now.getTime());
}

function item(
  id: GuideItemId,
  kind: GuideItem["kind"],
  href: GuideNavHref,
  severity: GuideItem["severity"],
  extra?: Pick<GuideItem, "count" | "categoryIds">
): GuideItem {
  return { id, kind, href, severity, ...extra };
}

function msInDays(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

export function evaluateGuide(input: GuideEvaluateInput): GuideResult {
  const {
    now,
    categories,
    categoriesReviewedAt,
    transactionMonthKeys,
    recentActivityAt,
    hasActiveExpenseRecurring,
    currentBudgetSet,
    nextBudgetSet,
    mismatchCategoryIds,
    overdueTaskCount,
    snoozedUntil,
  } = input;

  const daysLeft = daysUntilMonthEnd(now);
  const showNextBudgetWindow = daysLeft <= GUIDE_NEXT_BUDGET_DAYS;

  const hasThreeMonths = new Set(transactionMonthKeys).size >= 3;
  const categoriesDone = isCategoriesStepDone(categories, categoriesReviewedAt);

  // Setup steps in order — only incomplete ones are emitted (sequential primary CTA)
  const setupDefs: Array<{ done: boolean; item: GuideItem }> = [
    {
      done: categoriesDone,
      item: item("setup_categories", "setup", "/categories", "info"),
    },
    {
      done: hasThreeMonths,
      item: item("setup_import", "setup", "/import", "info"),
    },
    {
      done: hasActiveExpenseRecurring,
      item: item("setup_recurring", "setup", "/recurring", "info"),
    },
    {
      done: currentBudgetSet,
      item: item("setup_budget_current", "setup", "/categories", "info"),
    },
  ];

  if (showNextBudgetWindow) {
    setupDefs.push({
      done: nextBudgetSet,
      item: item("setup_budget_next", "setup", "/categories", "info"),
    });
  }

  const setupIncomplete = setupDefs.filter((s) => !s.done).map((s) => s.item);
  const setupComplete = setupIncomplete.length === 0;

  const habits: GuideItem[] = [];

  const weekAgo = now.getTime() - msInDays(GUIDE_WEEKLY_DAYS);
  const hasRecentActivity = Boolean(
    recentActivityAt && recentActivityAt.getTime() >= weekAgo
  );
  if (!hasRecentActivity) {
    habits.push(item("habit_weekly_activity", "habit", "/", "info"));
  }

  // Current budget habit only after setup (avoid duplicating setup CTAs)
  if (setupComplete && !currentBudgetSet) {
    habits.push(item("habit_budget_current", "habit", "/categories", "warning"));
  }

  // Next-month budget: when the window opens after setup was already complete earlier
  // in the month, it reappears as a setup step via setupDefs. No separate habit needed.

  if (setupComplete && mismatchCategoryIds.length > 0) {
    habits.push(
      item("habit_budget_mismatch", "habit", "/categories", "warning", {
        count: mismatchCategoryIds.length,
        categoryIds: mismatchCategoryIds,
      })
    );
  }

  if (overdueTaskCount > 0) {
    habits.push(
      item("habit_overdue_tasks", "habit", "/tasks", "warning", {
        count: overdueTaskCount,
      })
    );
  }

  const filterVisible = (items: GuideItem[]) =>
    items.filter((g) => !isSnoozed(g.id, snoozedUntil, now));

  const setup = filterVisible(setupIncomplete);
  const visibleHabits = filterVisible(habits);
  const allItems = [...setup, ...visibleHabits];

  const primary: GuideItem | null =
    setup[0] ??
    visibleHabits.find((h) => h.severity === "warning") ??
    visibleHabits[0] ??
    null;

  const navDots: GuideResult["navDots"] = {};
  for (const g of allItems) {
    if (
      g.href === "/categories" ||
      g.href === "/import" ||
      g.href === "/recurring" ||
      g.href === "/tasks"
    ) {
      navDots[g.href] = true;
    }
  }

  return {
    setup,
    habits: visibleHabits,
    primary,
    badgeCount: allItems.length,
    navDots,
    setupComplete,
    allItems,
  };
}

/** Distinct month keys from transaction dates. */
export function monthKeysFromDates(dates: Date[]): string[] {
  return [...new Set(dates.map((d) => getMonthKey(d)))];
}

/** Sum of positive category budget amounts. */
export function totalBudgetAmount(amounts: Record<string, number>): number {
  let total = 0;
  for (const v of Object.values(amounts)) {
    if (typeof v === "number" && v > 0) total += v;
  }
  return total;
}

/**
 * Guide treats a month budget as complete only when positive amounts exist
 * and planned expenses do not exceed planned monthly income
 * (saved budget income, or recurring income as fallback).
 * Income ≤ 0 still requires amounts (cannot validate balance without income).
 */
export function isGuideBudgetComplete(
  amounts: Record<string, number> | null | undefined,
  monthlyIncome: number
): boolean {
  if (!amounts) return false;
  const total = totalBudgetAmount(amounts);
  if (total <= 0) return false;
  if (monthlyIncome <= 0) return false;
  return total <= monthlyIncome;
}

/** Category ids where spent > budget or budget < recurring monthly. */
export function findMismatchCategoryIds(
  expenseCategoryIds: string[],
  spentByCategory: Record<string, number>,
  budgetByCategory: Record<string, number>,
  recurringByCategory: Record<string, number>
): string[] {
  const ids: string[] = [];
  for (const catId of expenseCategoryIds) {
    const spent = spentByCategory[catId] ?? 0;
    const budget = budgetByCategory[catId] ?? 0;
    const recurring = recurringByCategory[catId] ?? 0;
    if (budget > 0 && spent > budget) {
      ids.push(catId);
      continue;
    }
    if (recurring > 0 && budget < recurring) {
      ids.push(catId);
    }
  }
  return ids;
}
