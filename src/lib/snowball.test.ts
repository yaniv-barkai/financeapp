import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runSnowball, type SnowballDebtInput } from "./snowball";
import type { SnowballPlan } from "./types";

function plan(
  partial: Partial<SnowballPlan> &
    Pick<SnowballPlan, "nominalMonthlyIncome" | "monthlyExtra">
): Pick<
  SnowballPlan,
  | "nominalMonthlyIncome"
  | "monthlyExtra"
  | "oneTimeIncomes"
  | "emergencyFundMonths"
  | "monthlyIncomeForFund"
> {
  return {
    oneTimeIncomes: [],
    emergencyFundMonths: 0,
    monthlyIncomeForFund: 0,
    ...partial,
  };
}

describe("runSnowball", () => {
  it("pays a single no-min debt in phase 1", () => {
    const debts: SnowballDebtInput[] = [
      {
        id: "a",
        name: "Friend",
        balance: 1000,
        monthlyPayment: 0,
        forcePhase1: false,
      },
    ];
    const result = runSnowball(
      debts,
      plan({ nominalMonthlyIncome: 500, monthlyExtra: 0 })
    );
    assert.equal(result.stuck, false);
    assert.equal(result.phase1Months, 2);
    assert.equal(result.phase2Months, 0);
    assert.equal(result.phase3Months, 0);
    assert.equal(result.totalMonths, 2);
    assert.equal(result.debtPayoffMonth.a, 2);
  });

  it("uses cascading minimums in phase 3", () => {
    const debts: SnowballDebtInput[] = [
      {
        id: "small",
        name: "Small",
        balance: 200,
        monthlyPayment: 50,
        forcePhase1: false,
      },
      {
        id: "big",
        name: "Big",
        balance: 1000,
        monthlyPayment: 100,
        forcePhase1: false,
      },
    ];
    // Mins reduce principal too: small gets ~100/mo → paid month 2.
    // Then freed min cascades (200/mo on big from remaining 800) → month 6.
    const result = runSnowball(
      debts,
      plan({
        nominalMonthlyIncome: 200,
        monthlyExtra: 0,
        emergencyFundMonths: 0,
        monthlyIncomeForFund: 0,
      })
    );
    assert.equal(result.stuck, false);
    assert.equal(result.phase1Months, 0);
    assert.equal(result.debtPayoffMonth.small, 2);
    assert.equal(result.debtPayoffMonth.big, 6);
    assert.equal(result.totalMonths, 6);
  });

  it("builds emergency fund in phase 2 after phase 1", () => {
    const debts: SnowballDebtInput[] = [
      {
        id: "p1",
        name: "Tiny",
        balance: 100,
        monthlyPayment: 0,
        forcePhase1: false,
      },
      {
        id: "loan",
        name: "Loan",
        balance: 500,
        monthlyPayment: 50,
        forcePhase1: false,
      },
    ];
    const result = runSnowball(
      debts,
      plan({
        nominalMonthlyIncome: 150,
        monthlyExtra: 0,
        emergencyFundMonths: 2,
        monthlyIncomeForFund: 100, // EF target 200
      })
    );
    assert.equal(result.stuck, false);
    assert.equal(result.phase1Months, 1); // 100 paid with 150
    // After p1: each month pay loan min 50, put 100 toward EF → 2 months for EF
    assert.equal(result.phase2Months, 2);
    assert.ok((result.phase3Months ?? 0) >= 1);
    assert.equal(result.emergencyFundTarget, 200);
  });

  it("applies one-time income in the given month", () => {
    const debts: SnowballDebtInput[] = [
      {
        id: "a",
        name: "Bill",
        balance: 1000,
        monthlyPayment: 0,
        forcePhase1: false,
      },
    ];
    const result = runSnowball(
      debts,
      plan({
        nominalMonthlyIncome: 100,
        monthlyExtra: 0,
        oneTimeIncomes: [
          { id: "1", label: "Sell stuff", amount: 900, applyAfterMonths: 0 },
        ],
      })
    );
    assert.equal(result.phase1Months, 1);
    assert.equal(result.totalMonths, 1);
  });

  it("forcePhase1 puts a monthly debt into phase 1", () => {
    const debts: SnowballDebtInput[] = [
      {
        id: "forced",
        name: "CC",
        balance: 300,
        monthlyPayment: 100,
        forcePhase1: true,
      },
    ];
    const result = runSnowball(
      debts,
      plan({ nominalMonthlyIncome: 200, monthlyExtra: 0 })
    );
    assert.equal(result.phase1Months, 2);
    // Month1: min 100, attack 100 → 100 left; Month2: min 100 → paid
    assert.equal(result.debtPayoffMonth.forced, 2);
  });

  it("marks stuck when surplus cannot cover minimums", () => {
    const debts: SnowballDebtInput[] = [
      {
        id: "a",
        name: "Loan",
        balance: 5000,
        monthlyPayment: 500,
        forcePhase1: false,
      },
    ];
    const result = runSnowball(
      debts,
      plan({ nominalMonthlyIncome: 100, monthlyExtra: 0 })
    );
    assert.equal(result.stuck, true);
    assert.equal(result.stuckReason, "insufficient_for_minimums");
  });

  it("falls back to monthlyExtra when nominal is zero", () => {
    const debts: SnowballDebtInput[] = [
      {
        id: "a",
        name: "X",
        balance: 200,
        monthlyPayment: 0,
        forcePhase1: false,
      },
    ];
    const result = runSnowball(
      debts,
      plan({ nominalMonthlyIncome: 0, monthlyExtra: 200 })
    );
    assert.equal(result.phase1Months, 1);
  });
});
