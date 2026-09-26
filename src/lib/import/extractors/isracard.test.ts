import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectIsracardExport, extractIsracardTransactions } from "./isracard";
import { ParsedXlsx } from "@/lib/import/xlsx";

function sampleWorkbook(): ParsedXlsx {
  return {
    sheets: [
      {
        name: "דיסקונט לישראל 41-122200464",
        rows: [
          [
            "פירוט עסקאות לחשבון דיסקונט לישראל 41-122200464 לכרטיס ויזה פלטינום המסתיים ב-6233",
          ],
          [""],
          ["עסקאות לחיוב ב-02/10/2026: 2,290.90 ₪"],
          [
            "תאריך\r\nעסקה",
            "שם בית עסק",
            "סכום\r\nעסקה",
            "סכום\r\nחיוב",
            "סוג\r\nעסקה",
            "ענף",
            "הערות",
          ],
          ["21/9/26", "aliexpress", "₪ 60.91", "₪ 60.91", "רגילה", "מזון ומשקאות", ""],
          [
            "19/9/26",
            "YANGO DELI - APPLE PAY",
            "₪ 204.49",
            "₪ 204.49",
            "רגילה",
            "מזון ומשקאות",
            "",
          ],
          ["1/9/26", "פרימיום סיטי מרקט", "₪ -6.00", "₪ -6.00", "זיכוי", "", ""],
          [""],
          [
            "את המידע המלא על כל עסקה אפשר למצוא באתר ובאפליקציית כאל. מידע על חיובים בבנק נמצא בתפריט תחת ''סיכום חיובים בבנק''",
          ],
        ],
      },
    ],
  };
}

describe("Isracard extractor", () => {
  it("detects Isracard export headers (including newline-split headers)", () => {
    assert.equal(detectIsracardExport(sampleWorkbook()), true);
    assert.equal(
      detectIsracardExport({
        sheets: [{ name: "Sheet1", rows: [["Date", "Amount"]] }],
      }),
      false
    );
    // MAX-style "שם בית העסק" must not match Isracard detector
    assert.equal(
      detectIsracardExport({
        sheets: [
          {
            name: "MAX",
            rows: [["תאריך עסקה", "שם בית העסק", "סכום חיוב"]],
          },
        ],
      }),
      false
    );
  });

  it("extracts charged rows with last-4 from title and skips footer", () => {
    const result = extractIsracardTransactions(sampleWorkbook(), {
      merchantMemory: {},
      defaultCategoryId: "",
      defaultBookId: "book-1",
    });

    assert.equal(result.issuer, "isracard");
    assert.equal(result.rows.length, 3);

    const [aliexpress, yango, refund] = result.rows;
    assert.equal(aliexpress.merchantDisplay, "aliexpress");
    assert.equal(aliexpress.amount, 60.91);
    assert.equal(aliexpress.type, "expense");
    assert.deepEqual(aliexpress.pendingTagNames, ["6233"]);
    assert.equal(aliexpress.date.getFullYear(), 2026);
    assert.equal(aliexpress.date.getMonth(), 8);
    assert.equal(aliexpress.date.getDate(), 21);

    assert.equal(yango.merchantDisplay, "YANGO DELI - APPLE PAY");
    assert.equal(yango.amount, 204.49);

    assert.equal(refund.type, "income");
    assert.equal(refund.amount, 6);

    assert.deepEqual(result.pendingTagNames, ["6233"]);
  });
});
