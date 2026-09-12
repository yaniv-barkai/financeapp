import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  categoriesAreCustomized,
  evaluateGuide,
  findMismatchCategoryIds,
  isCategoriesStepDone,
  monthKeysFromDates,
  type GuideEvaluateInput,
} from "./evaluate";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from "@/lib/seeds";

function seedCategories() {
  return [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES].map(
    (c, i) => ({ id: `c${i}`, name: c.name, type: c.type })
  );
}

function baseInput(overrides: Partial<GuideEvaluateInput> = {}): GuideEvaluateInput {
  // Mid-month so next-budget is not in the setup window
  const now = new Date(2026, 5, 15, 12, 0, 0); // June 15 2026
  return {
    now,
    categories: seedCategories(),
    categoriesReviewedAt: new Date(2026, 5, 1),
    transactionMonthKeys: ["2026-04", "2026-05", "2026-06"],
    recentActivityAt: new Date(2026, 5, 14),
    hasActiveExpenseRecurring: true,
    currentBudgetSet: true,
    nextBudgetSet: true,
    mismatchCategoryIds: [],
    overdueTaskCount: 0,
    snoozedUntil: {},
    ...overrides,
  };
}

describe("categoriesAreCustomized", () => {
  it("returns false for exact seed set", () => {
    assert.equal(categoriesAreCustomized(seedCategories()), false);
  });

  it("returns true when a category is added", () => {
    const cats = [...seedCategories(), { id: "x", name: "Pets", type: "expense" as const }];
    assert.equal(categoriesAreCustomized(cats), true);
  });

  it("returns true when a seed name is changed", () => {
    const cats = seedCategories();
    cats[0] = { ...cats[0], name: "Rent renamed" };
    assert.equal(categoriesAreCustomized(cats), true);
  });
});

describe("isCategoriesStepDone", () => {
  it("is done when reviewed", () => {
    assert.equal(isCategoriesStepDone(seedCategories(), new Date()), true);
  });

  it("is done when customized even without review", () => {
    const cats = seedCategories().slice(0, -1);
    assert.equal(isCategoriesStepDone(cats, null), true);
  });

  it("is not done for untouched seeds", () => {
    assert.equal(isCategoriesStepDone(seedCategories(), null), false);
  });
});

describe("evaluateGuide", () => {
  it("returns empty primary when healthy", () => {
    const result = evaluateGuide(baseInput());
    assert.equal(result.setupComplete, true);
    assert.equal(result.primary, null);
    assert.equal(result.badgeCount, 0);
  });

  it("surfaces first incomplete setup step only as primary", () => {
    const result = evaluateGuide(
      baseInput({
        categoriesReviewedAt: null,
        transactionMonthKeys: [],
        hasActiveExpenseRecurring: false,
        currentBudgetSet: false,
      })
    );
    assert.equal(result.setupComplete, false);
    assert.equal(result.primary?.id, "setup_categories");
    assert.deepEqual(
      result.setup.map((s) => s.id),
      [
        "setup_categories",
        "setup_import",
        "setup_recurring",
        "setup_budget_current",
      ]
    );
  });

  it("advances primary after categories are reviewed", () => {
    const result = evaluateGuide(
      baseInput({
        categoriesReviewedAt: new Date(),
        transactionMonthKeys: ["2026-06"],
        hasActiveExpenseRecurring: false,
        currentBudgetSet: false,
      })
    );
    assert.equal(result.primary?.id, "setup_import");
    assert.equal(result.navDots["/import"], true);
  });

  it("requires next-month budget in last 7 days of month", () => {
    const now = new Date(2026, 5, 28, 12, 0, 0); // June 28 — 2 days left
    const result = evaluateGuide(
      baseInput({
        now,
        nextBudgetSet: false,
      })
    );
    assert.equal(result.setupComplete, false);
    assert.equal(result.primary?.id, "setup_budget_next");
  });

  it("flags weekly activity habit when stale", () => {
    const result = evaluateGuide(
      baseInput({
        recentActivityAt: new Date(2026, 5, 1),
      })
    );
    assert.equal(result.setupComplete, true);
    assert.equal(result.primary?.id, "habit_weekly_activity");
    assert.equal(result.badgeCount, 1);
  });

  it("flags budget mismatch after setup", () => {
    const result = evaluateGuide(
      baseInput({
        mismatchCategoryIds: ["a", "b", "c"],
      })
    );
    assert.equal(result.primary?.id, "habit_budget_mismatch");
    assert.equal(result.primary?.count, 3);
    assert.equal(result.primary?.severity, "warning");
    assert.equal(result.navDots["/categories"], true);
  });

  it("respects snooze", () => {
    const now = new Date(2026, 5, 15, 12, 0, 0);
    const result = evaluateGuide(
      baseInput({
        now,
        recentActivityAt: null,
        snoozedUntil: {
          habit_weekly_activity: new Date(2026, 5, 20),
        },
      })
    );
    assert.equal(result.badgeCount, 0);
    assert.equal(result.primary, null);
  });

  it("counts overdue tasks", () => {
    const result = evaluateGuide(baseInput({ overdueTaskCount: 2 }));
    assert.equal(result.primary?.id, "habit_overdue_tasks");
    assert.equal(result.navDots["/tasks"], true);
  });
});

describe("findMismatchCategoryIds", () => {
  it("detects overspend and below-recurring", () => {
    const ids = findMismatchCategoryIds(
      ["food", "rent", "fun"],
      { food: 120, rent: 50, fun: 10 },
      { food: 100, rent: 40, fun: 50 },
      { food: 0, rent: 80, fun: 0 }
    );
    assert.deepEqual(ids, ["food", "rent"]);
  });
});

describe("monthKeysFromDates", () => {
  it("returns distinct month keys", () => {
    const keys = monthKeysFromDates([
      new Date(2026, 0, 5),
      new Date(2026, 0, 20),
      new Date(2026, 1, 1),
    ]);
    assert.deepEqual(keys.sort(), ["2026-01", "2026-02"]);
  });
});
