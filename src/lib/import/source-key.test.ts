import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Timestamp } from "firebase/firestore";
import {
  buildSoftSourceKey,
  buildImportSourceKey,
  tagsFingerprint,
  markDuplicateRows,
  countExistingSoftKeys,
  softKeyFromTransaction,
} from "./source-key";
import { ImportRow, Transaction } from "@/lib/types";

function row(partial: Partial<ImportRow> & Pick<ImportRow, "id" | "date" | "amount" | "merchantNormalized">): ImportRow {
  return {
    merchantDisplay: partial.merchantDisplay ?? partial.merchantNormalized,
    type: "expense",
    categoryId: "cat1",
    bookId: "book1",
    skip: false,
    tags: [],
    ...partial,
  };
}

describe("tagsFingerprint", () => {
  it("sorts and dedupes tag ids", () => {
    assert.equal(tagsFingerprint(["b", "a", "b"]), "a,b");
    assert.equal(tagsFingerprint([]), "");
    assert.equal(tagsFingerprint(undefined), "");
  });
});

describe("buildSoftSourceKey", () => {
  it("uses Israel calendar day + amount + merchant", () => {
    // 2026-03-15 12:00 UTC → still 15th in Israel (UTC+2/+3)
    const d = new Date("2026-03-15T12:00:00.000Z");
    assert.equal(
      buildSoftSourceKey(d, 19.9, "פינק מרקט"),
      "2026-03-15:19.90:פינק מרקט"
    );
  });

  it("appends tags when present", () => {
    const d = new Date("2026-03-15T12:00:00.000Z");
    assert.equal(
      buildSoftSourceKey(d, 19.9, "פינק מרקט", ["tag-b", "tag-a"]),
      "2026-03-15:19.90:פינק מרקט:tags:tag-a,tag-b"
    );
  });

  it("does not append tags segment when empty", () => {
    const d = new Date("2026-03-15T12:00:00.000Z");
    assert.equal(
      buildSoftSourceKey(d, 10, "shop", []),
      "2026-03-15:10.00:shop"
    );
  });
});

describe("buildImportSourceKey", () => {
  it("prefixes source", () => {
    const d = new Date("2026-03-15T12:00:00.000Z");
    assert.equal(
      buildImportSourceKey("csv", d, 10, "shop", ["t1"]),
      "csv:2026-03-15:10.00:shop:tags:t1"
    );
  });
});

describe("softKeyFromTransaction", () => {
  it("includes tags from the transaction", () => {
    const soft = softKeyFromTransaction({
      date: Timestamp.fromDate(new Date("2026-03-15T12:00:00.000Z")),
      amount: 50,
      merchantNormalized: "cafe",
      tags: ["card-1234"],
    });
    assert.equal(soft, "2026-03-15:50.00:cafe:tags:card-1234");
  });
});

describe("markDuplicateRows", () => {
  const day = new Date("2026-03-15T12:00:00.000Z");

  it("marks exact matches as duplicates and skips them", () => {
    const existing = countExistingSoftKeys([
      {
        id: "tx1",
        type: "expense",
        amount: 100,
        categoryId: "c",
        merchantNormalized: "shop",
        date: Timestamp.fromDate(day),
        tags: ["card-1"],
        createdAt: Timestamp.now(),
      } as Transaction,
    ]);

    const rows = markDuplicateRows(
      [
        row({
          id: "r1",
          date: day,
          amount: 100,
          merchantNormalized: "shop",
          tags: ["card-1"],
        }),
        row({
          id: "r2",
          date: day,
          amount: 100,
          merchantNormalized: "shop",
          tags: [], // different tags → not a duplicate
        }),
        row({
          id: "r3",
          date: day,
          amount: 200,
          merchantNormalized: "shop",
          tags: ["card-1"],
        }),
      ],
      existing
    );

    assert.equal(rows[0].isDuplicate, true);
    assert.equal(rows[0].skip, true);
    assert.ok(rows[0].sourceKey?.startsWith("csv:"));
    assert.equal(rows[1].isDuplicate, false);
    assert.equal(rows[1].skip, false);
    assert.equal(rows[2].isDuplicate, false);
  });

  it("uses occurrence counts for same fingerprint", () => {
    const existing = countExistingSoftKeys([
      {
        id: "tx1",
        type: "expense",
        amount: 12,
        categoryId: "c",
        merchantNormalized: "coffee",
        date: Timestamp.fromDate(day),
        tags: [],
        createdAt: Timestamp.now(),
      } as Transaction,
    ]);

    const rows = markDuplicateRows(
      [
        row({ id: "a", date: day, amount: 12, merchantNormalized: "coffee" }),
        row({ id: "b", date: day, amount: 12, merchantNormalized: "coffee" }),
      ],
      existing
    );

    assert.equal(rows[0].isDuplicate, true);
    assert.equal(rows[1].isDuplicate, false);
  });

  it("keeps both when nothing exists yet", () => {
    const rows = markDuplicateRows(
      [
        row({ id: "a", date: day, amount: 12, merchantNormalized: "coffee" }),
        row({ id: "b", date: day, amount: 12, merchantNormalized: "coffee" }),
      ],
      new Map()
    );
    assert.equal(rows.every((r) => !r.isDuplicate), true);
    assert.equal(rows.every((r) => r.sourceKey), true);
  });
});
