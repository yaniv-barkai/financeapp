import { Category, Transaction } from "./types";

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
