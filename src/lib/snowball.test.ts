import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  estimateDebtInterest,
  runSnowball,
  sortDebtsByPayoffOrder,
  type SnowballDebtInput,
} from "./snowball";
import { effectiveAnnualRate, ISRAEL_PRIME_RATE } from "./prime";
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
  it("pays a single no-min debt in phase 3 (not marked pay-first)", () => {
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
    assert.equal(result.phase1Months, 0);
    assert.equal(result.phase2Months, 0);
    assert.equal(result.phase3Months, 2);
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
        forcePhase1: true,
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
    assert.equal(result.debtPayoffMonth.a, 1);
    assert.equal(result.totalMonths, 1);
  });

  it("rolls money left after a step into the next steps in the same month", () => {
    const debts: SnowballDebtInput[] = [
      { id: "p1", name: "Fine", balance: 500, monthlyPayment: 0, forcePhase1: true },
      { id: "loan", name: "Loan", balance: 20000, monthlyPayment: 500, forcePhase1: false },
    ];
    const result = runSnowball(
      debts,
      plan({
        nominalMonthlyIncome: 1000,
        monthlyExtra: 0,
        emergencyFundMonths: 1,
        monthlyIncomeForFund: 5000,
        oneTimeIncomes: [
          { id: "1", label: "Inheritance", amount: 100000, applyAfterMonths: 0 },
        ],
      })
    );
    assert.equal(result.stuck, false);
    assert.equal(result.debtPayoffMonth.p1, 1);
    assert.equal(result.debtPayoffMonth.loan, 1);
    assert.equal(result.totalMonths, 1);
    assert.equal(result.schedule[0].emergencyFund, 5000);
  });

  it("a larger monthly amount shortens a plan with pay-first debts and a fund", () => {
    const debts: SnowballDebtInput[] = [
      { id: "p1", name: "Fine", balance: 300, monthlyPayment: 0, forcePhase1: true },
      { id: "loan", name: "Loan", balance: 12000, monthlyPayment: 400, forcePhase1: false },
    ];
    const run = (available: number) =>
      runSnowball(
        debts,
        plan({
          nominalMonthlyIncome: available,
          monthlyExtra: 0,
          emergencyFundMonths: 1,
          monthlyIncomeForFund: 2000,
        })
      ).totalMonths;
    assert.equal(run(1_000_000), 1);
    assert.ok((run(5000) ?? Infinity) < (run(1500) ?? Infinity));
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
    assert.equal(result.totalMonths, 1);
  });

  it("pays debts with interest before interest-free ones, smallest first", () => {
    const debts: SnowballDebtInput[] = [
      {
        id: "family",
        name: "Family",
        balance: 300,
        monthlyPayment: 0,
        forcePhase1: false,
      },
      {
        id: "bigLoan",
        name: "Big loan",
        balance: 1000,
        monthlyPayment: 0,
        forcePhase1: false,
        annualInterestRate: 6,
      },
      {
        id: "smallLoan",
        name: "Small loan",
        balance: 500,
        monthlyPayment: 0,
        forcePhase1: false,
        annualInterestRate: 12,
      },
    ];
    const result = runSnowball(
      debts,
      plan({ nominalMonthlyIncome: 600, monthlyExtra: 0 })
    );
    assert.equal(result.stuck, false);
    const order = Object.entries(result.debtPayoffMonth)
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id);
    assert.deepEqual(order, ["smallLoan", "bigLoan", "family"]);
  });

  it("pays pay-first debts before everything else", () => {
    const debts: SnowballDebtInput[] = [
      {
        id: "loan",
        name: "Loan",
        balance: 200,
        monthlyPayment: 0,
        forcePhase1: false,
        annualInterestRate: 10,
      },
      {
        id: "fine",
        name: "Fine",
        balance: 400,
        monthlyPayment: 0,
        forcePhase1: true,
      },
    ];
    const result = runSnowball(
      debts,
      plan({ nominalMonthlyIncome: 400, monthlyExtra: 0 })
    );
    assert.equal(result.debtPayoffMonth.fine, 1);
    assert.equal(result.phase1Months, 1);
    assert.equal(result.debtPayoffMonth.loan, 2);
  });

  it("charges monthly interest before payments", () => {
    const debts: SnowballDebtInput[] = [
      {
        id: "a",
        name: "Loan",
        balance: 1200,
        monthlyPayment: 0,
        forcePhase1: false,
        annualInterestRate: 12, // 1% / month
      },
    ];
    const result = runSnowball(
      debts,
      plan({ nominalMonthlyIncome: 700, monthlyExtra: 0 })
    );
    // Month 1: 1200 + 12 = 1212 − 700 = 512; Month 2: 512 + 5.12 → paid.
    assert.equal(result.totalMonths, 2);
    assert.ok(Math.abs(result.totalInterest - 17.12) < 1e-6);
    assert.ok(Math.abs(result.debtInterest.a - 17.12) < 1e-6);
  });

  it("reports zero interest for interest-free debts", () => {
    const result = runSnowball(
      [
        {
          id: "a",
          name: "Friend",
          balance: 1000,
          monthlyPayment: 0,
          forcePhase1: false,
        },
      ],
      plan({ nominalMonthlyIncome: 500, monthlyExtra: 0 })
    );
    assert.equal(result.totalInterest, 0);
  });
});

describe("effectiveAnnualRate", () => {
  it("uses prime plus or minus the margin for prime debts", () => {
    assert.equal(
      effectiveAnnualRate({
        interestType: "prime",
        annualInterestRate: 0,
        primeMargin: 1.5,
      }),
      ISRAEL_PRIME_RATE + 1.5
    );
    assert.equal(
      effectiveAnnualRate({
        interestType: "prime",
        annualInterestRate: 0,
        primeMargin: -0.5,
      }),
      ISRAEL_PRIME_RATE - 0.5
    );
  });

  it("uses the fixed rate for fixed debts and never goes below zero", () => {
    assert.equal(
      effectiveAnnualRate({
        interestType: "fixed",
        annualInterestRate: 6,
        primeMargin: 3,
      }),
      6
    );
    assert.equal(
      effectiveAnnualRate({
        interestType: "prime",
        annualInterestRate: 0,
        primeMargin: -100,
      }),
      0
    );
  });
});

describe("pay-off order", () => {
  it("follows the manual order over the suggested one", () => {
    const debts: SnowballDebtInput[] = [
      { id: "small", name: "Small", balance: 200, monthlyPayment: 0, forcePhase1: false, payoffOrder: 1 },
      { id: "big", name: "Big", balance: 600, monthlyPayment: 0, forcePhase1: false, payoffOrder: 0 },
    ];
    const result = runSnowball(
      debts,
      plan({ nominalMonthlyIncome: 400, monthlyExtra: 0 })
    );
    assert.equal(result.debtPayoffMonth.big, 2);
    assert.equal(result.debtPayoffMonth.small, 2);
    assert.equal(result.schedule[0].payments.big, 400);
    assert.equal(result.schedule[0].payments.small, undefined);
  });

  it("keeps pay-first debts ahead of the manual order", () => {
    const debts: SnowballDebtInput[] = [
      { id: "loan", name: "Loan", balance: 300, monthlyPayment: 0, forcePhase1: false, payoffOrder: 0 },
      { id: "fine", name: "Fine", balance: 300, monthlyPayment: 0, forcePhase1: true, payoffOrder: 1 },
    ];
    const result = runSnowball(
      debts,
      plan({ nominalMonthlyIncome: 300, monthlyExtra: 0 })
    );
    assert.equal(result.debtPayoffMonth.fine, 1);
    assert.equal(result.debtPayoffMonth.loan, 2);
  });

  it("puts debts without a manual position after ordered ones", () => {
    const base = {
      monthlyPayment: 0,
      forcePhase1: false,
      interestType: "fixed" as const,
      annualInterestRate: 0,
      primeMargin: 0,
    };
    const sorted = sortDebtsByPayoffOrder([
      { ...base, name: "New small", balance: 50 },
      { ...base, name: "Second", balance: 900, payoffOrder: 1 },
      { ...base, name: "First", balance: 500, payoffOrder: 0 },
      { ...base, name: "Pay first", balance: 999, forcePhase1: true },
    ]);
    assert.deepEqual(
      sorted.map((d) => d.name),
      ["Pay first", "First", "Second", "New small"]
    );
  });
});

describe("runSnowball schedule", () => {
  it("records a month-by-month breakdown that adds up", () => {
    const debts: SnowballDebtInput[] = [
      {
        id: "card",
        name: "Card",
        balance: 1000,
        monthlyPayment: 100,
        forcePhase1: false,
        annualInterestRate: 12,
      },
      {
        id: "fine",
        name: "Fine",
        balance: 300,
        monthlyPayment: 0,
        forcePhase1: true,
      },
    ];
    const result = runSnowball(
      debts,
      plan({
        nominalMonthlyIncome: 400,
        monthlyExtra: 0,
        emergencyFundMonths: 1,
        monthlyIncomeForFund: 500,
        oneTimeIncomes: [
          { id: "ot", label: "Phone", amount: 200, applyAfterMonths: 1 },
        ],
      })
    );
    assert.equal(result.stuck, false);
    assert.equal(result.schedule.length, result.totalMonths);

    for (const entry of result.schedule) {
      const paid = Object.values(entry.payments).reduce((s, v) => s + v, 0);
      assert.ok(
        Math.abs(entry.moneyIn - (paid + entry.emergencyFundAdded + entry.unused)) < 1e-6,
        `month ${entry.month} money in should equal money out`
      );
      for (const id of Object.keys(entry.startBalances)) {
        const expected =
          entry.startBalances[id] +
          (entry.interest[id] ?? 0) -
          (entry.payments[id] ?? 0);
        assert.ok(Math.abs(entry.balances[id] - expected) < 1e-6);
      }
    }

    assert.equal(result.schedule[0].oneTimeIn, 0);
    assert.equal(result.schedule[1].oneTimeIn, 200);
    assert.equal(result.schedule[1].moneyIn, 600);
    assert.ok(Math.abs(result.schedule[0].interest.card - 10) < 1e-6);
    assert.equal(result.schedule[0].phase, 1);
    assert.equal(result.schedule[0].payments.fine, 300);
  });
});

describe("estimateDebtInterest", () => {
  it("sums interest when paying only the monthly payment", () => {
    // 1% / month on 1000, paying 510: m1 interest 10 → 500 left; m2 interest 5 → paid.
    const est = estimateDebtInterest(1000, 12, 510);
    assert.equal(est.months, 2);
    assert.ok(Math.abs((est.totalInterest ?? 0) - 15) < 1e-6);
  });

  it("returns null when the payment never covers the interest", () => {
    const est = estimateDebtInterest(10000, 12, 100);
    assert.equal(est.months, null);
    assert.equal(est.totalInterest, null);
    assert.ok(Math.abs(est.monthlyInterestNow - 100) < 1e-6);
  });

  it("reports the monthly interest for debts with no monthly payment", () => {
    // Overdraft: 12,000 at 12% a year → 120 a month, no end date.
    const est = estimateDebtInterest(12000, 12, 0);
    assert.equal(est.months, null);
    assert.equal(est.totalInterest, null);
    assert.ok(Math.abs(est.monthlyInterestNow - 120) < 1e-6);
  });

  it("is zero for interest-free debts", () => {
    const est = estimateDebtInterest(1000, 0, 100);
    assert.equal(est.months, 10);
    assert.equal(est.totalInterest, 0);
  });
});
