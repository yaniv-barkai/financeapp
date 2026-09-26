import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectMaxExport, extractMaxTransactions } from "./max";
import { ParsedXlsx } from "@/lib/import/xlsx";

function sampleWorkbook(): ParsedXlsx {
  return {
    sheets: [
      {
        name: "עסקאות במועד החיוב",
        rows: [
          ["כל המשתמשים (1)"],
          ["כל הכרטיסים (2)"],
          ["10/2026"],
          [
            "תאריך עסקה",
            "שם בית העסק",
            "קטגוריה",
            "4 ספרות אחרונות של כרטיס האשראי",
            "סוג עסקה",
            "סכום חיוב",
            "מטבע חיוב",
          ],
          ["01-09-2026", "פז אפליקציית יילו", "דלק", "4413", "רגילה", "201.29", "₪"],
          ["02-09-2026", "APPLE REFUND", "פנאי", "5525", "רגילה", "-4.12", "₪"],
          ["סך הכל"],
          ["197.17₪"],
        ],
      },
      {
        name: "עסקאות שאושרו וטרם נקלטו",
        rows: [
          ["כל המשתמשים (1)"],
          [
            "תאריך עסקה",
            "שם בית העסק",
            "קטגוריה",
            "4 ספרות אחרונות של כרטיס האשראי",
            "סוג עסקה",
            "סכום חיוב",
            "סכום עסקה מקורי",
          ],
          // Pending: no charge amount yet — should be skipped
          ["15-09-2026", "ענמ מסעדות", "מזון", "5525", "רגילה", "", "25"],
          ["סך הכל"],
        ],
      },
      {
        name: 'עסקאות חו"ל ומט"ח',
        rows: [
          [
            "תאריך עסקה",
            "שם בית העסק",
            "קטגוריה",
            "4 ספרות אחרונות של כרטיס האשראי",
            "סוג עסקה",
            "סכום חיוב",
          ],
          ["02-09-2026", "APPLE.COM/BILL", "פנאי", "5525", "מיידי", "39.9"],
          ["סך הכל"],
        ],
      },
    ],
  };
}

describe("MAX extractor", () => {
  it("detects MAX export headers", () => {
    assert.equal(detectMaxExport(sampleWorkbook()), true);
    assert.equal(
      detectMaxExport({ sheets: [{ name: "Sheet1", rows: [["Date", "Amount"]] }] }),
      false
    );
  });

  it("extracts charged rows with last-4 pending tags and skips pending without amount", () => {
    const result = extractMaxTransactions(sampleWorkbook(), {
      merchantMemory: {},
      defaultCategoryId: "",
      defaultBookId: "book-1",
    });

    assert.equal(result.issuer, "max");
    assert.equal(result.rows.length, 3);

    const [expense, refund, foreign] = result.rows;
    assert.equal(expense.merchantDisplay, "פז אפליקציית יילו");
    assert.equal(expense.amount, 201.29);
    assert.equal(expense.type, "expense");
    assert.deepEqual(expense.pendingTagNames, ["4413"]);
    assert.equal(expense.date.getFullYear(), 2026);
    assert.equal(expense.date.getMonth(), 8);
    assert.equal(expense.date.getDate(), 1);

    assert.equal(refund.type, "income");
    assert.equal(refund.amount, 4.12);
    assert.deepEqual(refund.pendingTagNames, ["5525"]);

    assert.equal(foreign.merchantDisplay, "APPLE.COM/BILL");
    assert.equal(foreign.amount, 39.9);

    assert.deepEqual(result.pendingTagNames.sort(), ["4413", "5525"]);
  });
});
