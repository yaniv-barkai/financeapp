import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { averageExpenseByCategory } from "./budget";
import type { Transaction } from "./types";

function tx(
  categoryId: string,
  amount: number,
  type: "expense" | "income" = "expense"
): Transaction {
  return { id: "t", categoryId, amount, type } as Transaction;
}

describe("averageExpenseByCategory", () => {
  it("averages total spend over the month window", () => {
    assert.deepEqual(
      averageExpenseByCategory(
        [tx("food", 300), tx("food", 150), tx("rent", 900)],
        3
      ),
      { food: 150, rent: 300 }
    );
  });

  it("returns empty for non-positive month count", () => {
    assert.deepEqual(averageExpenseByCategory([tx("food", 100)], 0), {});
  });
});
