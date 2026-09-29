import assert from "node:assert/strict";
import {
  mapMaxRawTransactions,
  parseInstallmentComment,
  shouldSkipMaxRawTxn,
} from "./max-installments.js";

assert.deepEqual(parseInstallmentComment("תשלום 1 מתוך 3"), {
  number: 1,
  total: 3,
});
assert.equal(parseInstallmentComment("הוראת קבע"), null);
assert.equal(parseInstallmentComment(""), null);

const siblings = [
  {
    merchantName: 'חברת החשמל לישראל בע"מ',
    actualPaymentAmount: 1717.52,
    originalAmount: 1717.52,
    comments: "הוראת קבע",
    purchaseDate: "2026-09-03T00:00:00",
    paymentDate: "2026-09-10T00:00:00",
  },
  {
    merchantName: 'חברת החשמל לישראל בע"מ',
    actualPaymentAmount: -1717.52,
    originalAmount: 1717.52,
    comments: "",
    purchaseDate: "2026-09-03T00:00:00",
    paymentDate: "2026-09-10T00:00:00",
  },
  {
    merchantName: 'חברת החשמל לישראל בע"מ',
    actualPaymentAmount: 572.5,
    originalAmount: 1717.52,
    comments: "תשלום 1 מתוך 3",
    purchaseDate: "2026-09-03T00:00:00",
    paymentDate: "2026-09-10T00:00:00",
  },
  {
    merchantName: 'חברת החשמל לישראל בע"מ',
    actualPaymentAmount: 572.51,
    originalAmount: 1717.52,
    comments: "תשלום 2 מתוך 3",
    purchaseDate: "2026-09-03T00:00:00",
    paymentDate: "2026-10-11T00:00:00",
  },
];

assert.equal(shouldSkipMaxRawTxn(siblings[0], siblings), true);
assert.equal(shouldSkipMaxRawTxn(siblings[1], siblings), true);
assert.equal(shouldSkipMaxRawTxn(siblings[2], siblings), false);
assert.equal(shouldSkipMaxRawTxn(siblings[3], siblings), false);

const mapped = mapMaxRawTransactions(siblings);
assert.equal(mapped.length, 2);
assert.equal(mapped[0].amount, 572.5);
assert.equal(mapped[0].note, "תשלום 1 מתוך 3");
assert.deepEqual(mapped[0].installments, { number: 1, total: 3 });
assert.equal(mapped[0].date.toISOString().slice(0, 10), "2026-09-10");
assert.equal(mapped[1].amount, 572.51);
assert.equal(mapped[1].date.toISOString().slice(0, 10), "2026-10-11");
assert.deepEqual(mapped[1].installments, { number: 2, total: 3 });

// Non-spread standing order should be kept
const standing = mapMaxRawTransactions([
  {
    merchantName: 'חברת החשמל לישראל בע"מ',
    actualPaymentAmount: 605.46,
    originalAmount: 605.46,
    comments: "הוראת קבע",
    purchaseDate: "2026-07-06T00:00:00",
    paymentDate: "2026-07-10T00:00:00",
  },
]);
assert.equal(standing.length, 1);
assert.equal(standing[0].amount, 605.46);
assert.equal(standing[0].note, "הוראת קבע");
assert.equal(standing[0].installments, undefined);
assert.equal(standing[0].date.toISOString().slice(0, 10), "2026-07-06");

// Installment rows keep their billing date and carry no separate billingDate
assert.equal(mapped[1].billingDate, undefined);

// Regular purchase billed next month stays in the purchase month
const purchase = mapMaxRawTransactions([
  {
    merchantName: "שופרסל דיל",
    actualPaymentAmount: 312.4,
    originalAmount: 312.4,
    comments: "",
    purchaseDate: "2026-09-24T00:00:00",
    paymentDate: "2026-10-10T00:00:00",
  },
]);
assert.equal(purchase.length, 1);
assert.equal(purchase[0].date.toISOString().slice(0, 10), "2026-09-24");
assert.equal(purchase[0].billingDate?.toISOString().slice(0, 10), "2026-10-10");

console.log("max-installments tests passed");
