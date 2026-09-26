import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Timestamp } from "firebase/firestore";
import {
  dayOfMonthDistance,
  detectRecurringSuggestions,
  nextRunFromSuggestion,
  suggestionFingerprint,
} from "./recurring-suggestions";
import { Recurring, Transaction } from "./types";

function tx(opts: {
  date: Date;
  amount: number;
  merchantDisplay: string;
  id?: string;
  type?: Transaction["type"];
  categoryId?: string;
  merchantNormalized?: string;
  recurringId?: string;
}): Transaction {
  const merchantDisplay = opts.merchantDisplay;
  return {
    id: opts.id ?? `tx-${opts.date.toISOString()}-${opts.amount}`,
    type: opts.type ?? "expense",
    amount: opts.amount,
    categoryId: opts.categoryId ?? "cat-1",
    merchantDisplay,
    merchantNormalized:
      opts.merchantNormalized !== undefined
        ? opts.merchantNormalized
        : merchantDisplay.toLowerCase(),
    date: Timestamp.fromDate(opts.date),
    tags: [],
    createdAt: Timestamp.fromDate(opts.date),
    ...(opts.recurringId ? { recurringId: opts.recurringId } : {}),
  };
}

function recurring(opts: {
  merchantDisplay: string;
  amount: number;
  id?: string;
  categoryId?: string;
  active?: boolean;
  dayOfMonth?: number;
}): Recurring {
  return {
    id: opts.id ?? "r1",
    type: "expense",
    amount: opts.amount,
    categoryId: opts.categoryId ?? "cat-1",
    merchantDisplay: opts.merchantDisplay,
    cadence: "monthly",
    nextRunDate: Timestamp.fromDate(new Date(2026, 8, 15)),
    active: opts.active ?? true,
    createdAt: Timestamp.fromDate(new Date(2026, 0, 1)),
    ...(opts.dayOfMonth !== undefined ? { dayOfMonth: opts.dayOfMonth } : {}),
  };
}

describe("dayOfMonthDistance", () => {
  it("returns absolute day difference", () => {
    assert.equal(dayOfMonthDistance(10, 12), 2);
    assert.equal(dayOfMonthDistance(1, 1), 0);
    assert.equal(dayOfMonthDistance(28, 31), 3);
  });
});

describe("detectRecurringSuggestions", () => {
  const netflix = [
    tx({ date: new Date(2026, 6, 12), amount: 49.9, merchantDisplay: "Netflix" }),
    tx({ date: new Date(2026, 7, 13), amount: 49.9, merchantDisplay: "Netflix" }),
    tx({ date: new Date(2026, 8, 11), amount: 49.9, merchantDisplay: "Netflix" }),
  ];

  it("suggests when expense appears all 3 months near the same day", () => {
    const result = detectRecurringSuggestions(netflix, [], {
      anchorMonthKey: "2026-09",
      monthsBack: 3,
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].merchantNormalized, "netflix");
    assert.equal(result[0].amount, 49.9);
    assert.equal(result[0].monthsMatched.length, 3);
    assert.ok(result[0].dayOfMonth >= 11 && result[0].dayOfMonth <= 13);
  });

  it("allows up to 3 days before/after the anchor day", () => {
    const txs = [
      tx({ date: new Date(2026, 6, 5), amount: 100, merchantDisplay: "Gym" }),
      tx({ date: new Date(2026, 7, 8), amount: 100, merchantDisplay: "Gym" }),
      tx({ date: new Date(2026, 8, 2), amount: 100, merchantDisplay: "Gym" }),
    ];
    const result = detectRecurringSuggestions(txs, [], {
      anchorMonthKey: "2026-09",
    });
    assert.equal(result.length, 1);
  });

  it("rejects when day drift exceeds 3 days", () => {
    const txs = [
      tx({ date: new Date(2026, 6, 1), amount: 20, merchantDisplay: "Spotify" }),
      tx({ date: new Date(2026, 7, 1), amount: 20, merchantDisplay: "Spotify" }),
      tx({ date: new Date(2026, 8, 10), amount: 20, merchantDisplay: "Spotify" }),
    ];
    const result = detectRecurringSuggestions(txs, [], {
      anchorMonthKey: "2026-09",
    });
    assert.equal(result.length, 0);
  });

  it("rejects one-offs that only appear in 2 of 3 months by default", () => {
    const txs = [
      tx({ date: new Date(2026, 6, 12), amount: 49.9, merchantDisplay: "Netflix" }),
      tx({ date: new Date(2026, 8, 12), amount: 49.9, merchantDisplay: "Netflix" }),
    ];
    const result = detectRecurringSuggestions(txs, [], {
      anchorMonthKey: "2026-09",
    });
    assert.equal(result.length, 0);
  });

  it("can allow 2 of 3 months when configured", () => {
    const txs = [
      tx({ date: new Date(2026, 6, 12), amount: 49.9, merchantDisplay: "Netflix" }),
      tx({ date: new Date(2026, 8, 12), amount: 49.9, merchantDisplay: "Netflix" }),
    ];
    const result = detectRecurringSuggestions(txs, [], {
      anchorMonthKey: "2026-09",
      minMonthsMatched: 2,
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].monthsMatched.length, 2);
  });

  it("ignores income and already-linked recurring transactions", () => {
    const txs = [
      tx({
        date: new Date(2026, 6, 1),
        amount: 5000,
        merchantDisplay: "Salary",
        type: "income",
      }),
      tx({
        date: new Date(2026, 7, 1),
        amount: 5000,
        merchantDisplay: "Salary",
        type: "income",
      }),
      tx({
        date: new Date(2026, 8, 1),
        amount: 5000,
        merchantDisplay: "Salary",
        type: "income",
      }),
      tx({
        date: new Date(2026, 6, 12),
        amount: 49.9,
        merchantDisplay: "Netflix",
        recurringId: "existing-r",
      }),
      tx({ date: new Date(2026, 7, 12), amount: 49.9, merchantDisplay: "Netflix" }),
      tx({ date: new Date(2026, 8, 12), amount: 49.9, merchantDisplay: "Netflix" }),
    ];
    const result = detectRecurringSuggestions(txs, [], {
      anchorMonthKey: "2026-09",
    });
    assert.equal(result.length, 0);
  });

  it("skips suggestions that already match an active recurring item", () => {
    const result = detectRecurringSuggestions(
      netflix,
      [recurring({ merchantDisplay: "Netflix", amount: 49.9 })],
      { anchorMonthKey: "2026-09" }
    );
    assert.equal(result.length, 0);
  });

  it("finds recurring subset among noisy same-merchant charges (ITUNES)", () => {
    const txs = [
      tx({ date: new Date(2026, 6, 3), amount: 4.9, merchantDisplay: "ITUNES" }),
      tx({ date: new Date(2026, 6, 8), amount: 29.9, merchantDisplay: "ITUNES" }),
      tx({ date: new Date(2026, 6, 15), amount: 14.9, merchantDisplay: "ITUNES" }),
      tx({ date: new Date(2026, 6, 22), amount: 9.9, merchantDisplay: "ITUNES" }),
      tx({ date: new Date(2026, 7, 2), amount: 14.9, merchantDisplay: "ITUNES" }),
      tx({ date: new Date(2026, 7, 5), amount: 7.9, merchantDisplay: "ITUNES" }),
      tx({ date: new Date(2026, 7, 16), amount: 14.9, merchantDisplay: "ITUNES" }),
      tx({ date: new Date(2026, 7, 28), amount: 49.9, merchantDisplay: "ITUNES" }),
      tx({ date: new Date(2026, 8, 1), amount: 2.9, merchantDisplay: "ITUNES" }),
      tx({ date: new Date(2026, 8, 10), amount: 19.9, merchantDisplay: "ITUNES" }),
      tx({ date: new Date(2026, 8, 14), amount: 14.9, merchantDisplay: "ITUNES" }),
      tx({ date: new Date(2026, 8, 25), amount: 14.9, merchantDisplay: "ITUNES" }),
    ];
    const result = detectRecurringSuggestions(txs, [], {
      anchorMonthKey: "2026-09",
    });
    const match = result.find((s) => s.amount === 14.9 && s.monthsMatched.length === 3);
    assert.ok(match, "expected a $14.90 ITUNES suggestion across 3 months");
    assert.ok(match!.dayOfMonth >= 14 && match!.dayOfMonth <= 16);
  });

  it("does not suggest a single one-off even when amount/merchant match another month loosely", () => {
    const txs = [
      tx({ date: new Date(2026, 6, 12), amount: 87.5, merchantDisplay: "Super" }),
      tx({ date: new Date(2026, 7, 5), amount: 120, merchantDisplay: "Super" }),
      tx({ date: new Date(2026, 8, 20), amount: 45, merchantDisplay: "Super" }),
    ];
    const result = detectRecurringSuggestions(txs, [], {
      anchorMonthKey: "2026-09",
    });
    assert.equal(result.length, 0);
  });

  it("does not let a coincidental day series block the real recurring one", () => {
    const txs = [
      tx({ date: new Date(2026, 6, 28), amount: 10, merchantDisplay: "ITUNES", id: "j28" }),
      tx({ date: new Date(2026, 7, 15), amount: 10, merchantDisplay: "ITUNES", id: "a15" }),
      tx({ date: new Date(2026, 7, 28), amount: 10, merchantDisplay: "ITUNES", id: "a28" }),
      tx({ date: new Date(2026, 8, 15), amount: 10, merchantDisplay: "ITUNES", id: "s15" }),
      tx({ date: new Date(2026, 8, 29), amount: 10, merchantDisplay: "ITUNES", id: "s29" }),
    ];
    const result = detectRecurringSuggestions(txs, [], {
      anchorMonthKey: "2026-09",
      minMonthsMatched: 2,
    });
    // Day ~15 appears in Aug+Sep; day ~28 appears in Jul+Aug (+Sep 29 within ±3 of 28)
    assert.ok(result.length >= 1);
    const midMonth = result.find((s) => s.dayOfMonth >= 14 && s.dayOfMonth <= 16);
    assert.ok(midMonth, "expected mid-month series to be found");
  });

  it("can suggest multiple series for the same merchant with different amounts", () => {
    const txs = [
      tx({ date: new Date(2026, 6, 5), amount: 14.9, merchantDisplay: "ITUNES" }),
      tx({ date: new Date(2026, 6, 20), amount: 9.9, merchantDisplay: "ITUNES" }),
      tx({ date: new Date(2026, 7, 5), amount: 14.9, merchantDisplay: "ITUNES" }),
      tx({ date: new Date(2026, 7, 21), amount: 9.9, merchantDisplay: "ITUNES" }),
      tx({ date: new Date(2026, 8, 4), amount: 14.9, merchantDisplay: "ITUNES" }),
      tx({ date: new Date(2026, 8, 20), amount: 9.9, merchantDisplay: "ITUNES" }),
    ];
    const result = detectRecurringSuggestions(txs, [], {
      anchorMonthKey: "2026-09",
    });
    assert.equal(result.length, 2);
    const amounts = result.map((s) => s.amount).sort((a, b) => a - b);
    assert.deepEqual(amounts, [9.9, 14.9]);
  });

  it("requires the exact same amount — slight differences do not cluster", () => {
    const txs = [
      tx({ date: new Date(2026, 6, 12), amount: 49.9, merchantDisplay: "Netflix" }),
      tx({ date: new Date(2026, 7, 12), amount: 49.91, merchantDisplay: "Netflix" }),
      tx({ date: new Date(2026, 8, 12), amount: 49.9, merchantDisplay: "Netflix" }),
    ];
    const result = detectRecurringSuggestions(txs, [], {
      anchorMonthKey: "2026-09",
    });
    // 49.90 only in Jul+Sep; 49.91 only once → nothing reaches 3 months
    assert.equal(result.length, 0);
  });

  it("does not group similar but different amounts at the same merchant", () => {
    const txs = [
      tx({ date: new Date(2026, 6, 5), amount: 100, merchantDisplay: "Gym" }),
      tx({ date: new Date(2026, 7, 5), amount: 102, merchantDisplay: "Gym" }),
      tx({ date: new Date(2026, 8, 5), amount: 100, merchantDisplay: "Gym" }),
    ];
    const result = detectRecurringSuggestions(txs, [], {
      anchorMonthKey: "2026-09",
    });
    assert.equal(result.length, 0);
  });

  it("skips dismissed fingerprints", () => {
    const fp = suggestionFingerprint("netflix", 49.9, 12);
    const result = detectRecurringSuggestions(netflix, [], {
      anchorMonthKey: "2026-09",
      dismissedFingerprints: [fp],
    });
    assert.equal(result.length, 0);
  });

  it("ignores merchants without a name", () => {
    const txs = [
      tx({
        date: new Date(2026, 6, 5),
        amount: 10,
        merchantDisplay: "   ",
        merchantNormalized: "",
      }),
      tx({
        date: new Date(2026, 7, 5),
        amount: 10,
        merchantDisplay: "   ",
        merchantNormalized: "",
      }),
      tx({
        date: new Date(2026, 8, 5),
        amount: 10,
        merchantDisplay: "   ",
        merchantNormalized: "",
      }),
    ];
    const result = detectRecurringSuggestions(txs, [], {
      anchorMonthKey: "2026-09",
    });
    assert.equal(result.length, 0);
  });
});

describe("nextRunFromSuggestion", () => {
  it("returns this month when day is still ahead", () => {
    const from = new Date(2026, 8, 10, 12, 0, 0);
    const next = nextRunFromSuggestion(15, from);
    assert.equal(next.getFullYear(), 2026);
    assert.equal(next.getMonth(), 8);
    assert.equal(next.getDate(), 15);
  });

  it("rolls to next month when day already passed", () => {
    const from = new Date(2026, 8, 20, 12, 0, 0);
    const next = nextRunFromSuggestion(15, from);
    assert.equal(next.getMonth(), 9);
    assert.equal(next.getDate(), 15);
  });
});
