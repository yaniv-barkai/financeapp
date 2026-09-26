import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Timestamp } from "firebase/firestore";
import {
  averageExpenseByCategory,
  averageIncomeByCategory,
  lookbackMonthKeys,
} from "./budget";
import type { Transaction } from "./types";

function tx(
  categoryId: string,
  amount: number,
  monthKey: string,
  type: "expense" | "income" = "expense"
): Transaction {
  const [year, month] = monthKey.split("-").map(Number);
  return {
    id: "t",
    categoryId,
    amount,
    type,
    date: Timestamp.fromDate(new Date(year, month - 1, 15)),
  } as Transaction;
}

describe("lookbackMonthKeys", () => {
  it("returns oldest-first keys ending at endKey", () => {
    assert.deepEqual(lookbackMonthKeys("2026-08", 3), [
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
  });

  it("returns empty for non-positive count", () => {
    assert.deepEqual(lookbackMonthKeys("2026-08", 0), []);
  });
});

describe("averageExpenseByCategory", () => {
  it("averages month buckets and divides by months with activity", () => {
    const keys = ["2026-06", "2026-07", "2026-08"];
    assert.deepEqual(
      averageExpenseByCategory(
        [
          tx("food", 300, "2026-06"),
          tx("food", 150, "2026-07"),
          tx("rent", 900, "2026-08"),
        ],
        keys
      ),
      { food: 150, rent: 300 }
    );
  });

  it("does not divide by empty months when only one month has activity", () => {
    const keys = ["2026-06", "2026-07", "2026-08"];
    assert.deepEqual(
      averageExpenseByCategory([tx("food", 300, "2026-08")], keys),
      { food: 300 }
    );
  });

  it("returns empty for empty month keys", () => {
    assert.deepEqual(averageExpenseByCategory([tx("food", 100, "2026-08")], []), {});
  });
});

describe("averageIncomeByCategory", () => {
  it("averages income across active months", () => {
    const keys = ["2026-06", "2026-07", "2026-08"];
    assert.deepEqual(
      averageIncomeByCategory(
        [
          tx("salary", 10000, "2026-06", "income"),
          tx("salary", 10000, "2026-07", "income"),
          tx("bonus", 3000, "2026-08", "income"),
        ],
        keys
      ),
      { salary: 20000 / 3, bonus: 1000 }
    );
  });
});
