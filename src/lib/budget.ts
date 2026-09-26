import { Category, Transaction } from "./types";
import { getMonthKey, getPrevMonthKey } from "./utils";

export interface CategoryBudgetRow {
  catId: string;
  name: string;
  spent: number;
  limit: number;
  pct: number;
}

/** Sum expense amounts minus income in the same category for the period. */
export function computeExpenseByCategory(
  transactions: Transaction[]
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const tx of transactions) {
    const delta = tx.type === "expense" ? tx.amount : -tx.amount;
    map[tx.categoryId] = (map[tx.categoryId] ?? 0) + delta;
  }
  const result: Record<string, number> = {};
  for (const [catId, amount] of Object.entries(map)) {
    result[catId] = Math.max(0, amount);
  }
  return result;
}

/** Sum income amounts per category for the period. */
export function computeIncomeByCategory(
  transactions: Transaction[]
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.type !== "income") continue;
    map[tx.categoryId] = (map[tx.categoryId] ?? 0) + tx.amount;
  }
  return map;
}

/**
 * Month keys for a lookback window ending at `endKey` (inclusive), oldest first.
 * Example: lookbackMonthKeys("2026-08", 3) → ["2026-06", "2026-07", "2026-08"]
 */
export function lookbackMonthKeys(endKey: string, count: number): string[] {
  if (count <= 0) return [];
  const keys: string[] = [];
  let cur = endKey;
  for (let i = 0; i < count; i++) {
    keys.unshift(cur);
    cur = getPrevMonthKey(cur);
  }
  return keys;
}

function averageByCategory(
  transactions: Transaction[],
  monthKeys: string[],
  computeForMonth: (txs: Transaction[]) => Record<string, number>
): Record<string, number> {
  if (monthKeys.length === 0) return {};

  const byMonth = new Map<string, Transaction[]>();
  for (const key of monthKeys) byMonth.set(key, []);

  for (const tx of transactions) {
    const mk = getMonthKey(tx.date.toDate());
    const bucket = byMonth.get(mk);
    if (bucket) bucket.push(tx);
  }

  const activeMonths = monthKeys.filter((k) => (byMonth.get(k)?.length ?? 0) > 0);
  const divisor = activeMonths.length;
  if (divisor === 0) return {};

  const totals: Record<string, number> = {};
  for (const key of monthKeys) {
    const monthTotals = computeForMonth(byMonth.get(key) ?? []);
    for (const [catId, amount] of Object.entries(monthTotals)) {
      totals[catId] = (totals[catId] ?? 0) + amount;
    }
  }

  const result: Record<string, number> = {};
  for (const [catId, amount] of Object.entries(totals)) {
    result[catId] = amount / divisor;
  }
  return result;
}

/**
 * Average monthly expense per category over the given month keys.
 * Divides by months that have any book activity (not always by key count).
 */
export function averageExpenseByCategory(
  transactions: Transaction[],
  monthKeys: string[]
): Record<string, number> {
  return averageByCategory(transactions, monthKeys, computeExpenseByCategory);
}

/**
 * Average monthly income per category over the given month keys.
 * Divides by months that have any book activity (not always by key count).
 */
export function averageIncomeByCategory(
  transactions: Transaction[],
  monthKeys: string[]
): Record<string, number> {
  return averageByCategory(transactions, monthKeys, computeIncomeByCategory);
}

/**
 * Reset category budgets to the recurring floor (or 0 when there is no recurring).
 * Amounts are rounded to whole currency units for the editor.
 */
export function cleanedBudgetAmounts(
  categoryIds: string[],
  recurringByCat: Record<string, number>
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const catId of categoryIds) {
    const floor = Math.round(recurringByCat[catId] ?? 0);
    if (floor > 0) result[catId] = floor;
  }
  return result;
}

export function buildCategoryBudgetRows(
  categories: Category[],
  limits: Record<string, number>,
  expenseByCategory: Record<string, number>
): CategoryBudgetRow[] {
  return categories
    .filter((c) => c.type === "expense")
    .map((cat) => {
      const spent = expenseByCategory[cat.id] ?? 0;
      const limit = limits[cat.id];
      const hasLimit = limit !== undefined && limit > 0;
      const pct = hasLimit ? (spent / limit) * 100 : 0;
      return {
        catId: cat.id,
        name: cat.name,
        spent,
        limit: limit ?? 0,
        pct,
      };
    })
    .filter((row) => row.limit > 0);
}

export interface BudgetThresholdCrossing {
  catId: string;
  categoryName: string;
  threshold: number;
  spent: number;
  limit: number;
  pct: number;
}

/** Thresholds crossed upward that haven't been alerted yet this month. */
export function findNewThresholdCrossings(
  rows: CategoryBudgetRow[],
  thresholds: number[],
  alreadySent: Record<string, number>
): BudgetThresholdCrossing[] {
  const sorted = [...thresholds].sort((a, b) => a - b);
  const crossings: BudgetThresholdCrossing[] = [];

  for (const row of rows) {
    const prev = alreadySent[row.catId] ?? 0;
    for (const threshold of sorted) {
      if (row.pct >= threshold && threshold > prev) {
        crossings.push({
          catId: row.catId,
          categoryName: row.name,
          threshold,
          spent: row.spent,
          limit: row.limit,
          pct: row.pct,
        });
      }
    }
  }

  return crossings;
}
