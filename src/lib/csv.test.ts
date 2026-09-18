import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autoDetectColumns, parseCsvAmount, buildImportRows } from "./csv";

describe("autoDetectColumns", () => {
  it("prefers charged ILS over original/foreign amount", () => {
    const detected = autoDetectColumns([
      "תאריך עסקה",
      "שם בית עסק",
      "סכום מקורי",
      "מטבע מקורי",
      "סכום חיוב",
    ]);
    assert.equal(detected.amountCol, "סכום חיוב");
    assert.equal(detected.merchantCol, "שם בית עסק");
    assert.equal(detected.dateCol, "תאריך עסקה");
  });

  it("prefers Amount (ILS) over Amount (USD)", () => {
    const detected = autoDetectColumns([
      "Transaction Date",
      "Payee",
      "Amount (USD)",
      "Amount (ILS)",
    ]);
    assert.equal(detected.amountCol, "Amount (ILS)");
    assert.equal(detected.merchantCol, "Payee");
  });

  it("prefers Amount over Original Amount", () => {
    const detected = autoDetectColumns([
      "Date",
      "Description",
      "Original Amount",
      "Currency",
      "Amount",
    ]);
    assert.equal(detected.amountCol, "Amount");
    assert.equal(detected.merchantCol, "Description");
  });
});

describe("parseCsvAmount", () => {
  it("parses US and EU formats", () => {
    assert.equal(parseCsvAmount("1,234.56"), 1234.56);
    assert.equal(parseCsvAmount("1.234,56"), 1234.56);
    assert.equal(parseCsvAmount("1234,56"), 1234.56);
    assert.equal(parseCsvAmount("₪1,234.50"), 1234.5);
    assert.equal(parseCsvAmount("$12.00"), 12);
    assert.equal(parseCsvAmount("(45.00)"), -45);
    assert.equal(parseCsvAmount("-12.5"), -12.5);
  });
});

describe("buildImportRows", () => {
  it("builds rows from Hebrew bank-style CSV columns", () => {
    const rows = buildImportRows(
      [
        {
          "תאריך עסקה": "15/03/2026",
          "שם בית עסק": "שופרסל",
          "סכום חיוב": "123,45",
        },
      ],
      {
        dateCol: "תאריך עסקה",
        merchantCol: "שם בית עסק",
        amountCol: "סכום חיוב",
        negativeIsExpense: false,
        merchantMemory: {},
        defaultCategoryId: "",
        defaultBookId: "book1",
        dateFormat: "DMY",
      }
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].merchantDisplay, "שופרסל");
    assert.equal(rows[0].amount, 123.45);
    assert.equal(rows[0].type, "expense");
  });
});
