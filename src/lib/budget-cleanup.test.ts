import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanedBudgetAmounts } from "./budget";

describe("cleanedBudgetAmounts", () => {
  it("zeros categories without recurring and keeps recurring floors", () => {
    assert.deepEqual(
      cleanedBudgetAmounts(["rent", "food", "fun"], {
        rent: 3200.4,
        food: 0,
      }),
      { rent: 3200 }
    );
  });

  it("returns empty when nothing has a recurring floor", () => {
    assert.deepEqual(cleanedBudgetAmounts(["a", "b"], {}), {});
  });
});
