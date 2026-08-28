import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "./firebase.js";
import { normalizeMerchant } from "./utils.js";

export interface ScrapedRow {
  date: Date;
  amount: number;
  merchantDisplay: string;
  merchantNormalized: string;
  sourceKey: string;
}

export interface CategoryDoc {
  id: string;
  name: string;
  nameEn?: string;
  icon?: string;
  type: string;
}

export async function loadCategories(uid: string, bookId: string): Promise<CategoryDoc[]> {
  const snap = await getDb()
    .collection(`users/${uid}/books/${bookId}/categories`)
    .orderBy("order")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CategoryDoc, "id">) }));
}

export async function loadMerchantMemory(
  uid: string,
  bookId: string
): Promise<Record<string, string>> {
  const snap = await getDb().collection(`users/${uid}/books/${bookId}/merchants`).get();
  const map: Record<string, string> = {};
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.defaultCategoryId) map[doc.id] = data.defaultCategoryId as string;
  }
  return map;
}

export async function loadExistingSourceKeys(
  uid: string,
  bookId: string,
  start: Date
): Promise<Set<string>> {
  const snap = await getDb()
    .collection(`users/${uid}/books/${bookId}/transactions`)
    .where("date", ">=", Timestamp.fromDate(start))
    .get();

  const keys = new Set<string>();
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.sourceKey) keys.add(data.sourceKey as string);
  }
  return keys;
}

export async function importRows(
  uid: string,
  bookId: string,
  rows: Array<{
    date: Date;
    amount: number;
    merchantDisplay: string;
    merchantNormalized: string;
    categoryId: string;
    sourceKey: string;
  }>,
  opts?: { skipMemoryCategoryIds?: Set<string> }
): Promise<number> {
  if (!rows.length) return 0;

  const db = getDb();
  const CHUNK = 400;
  let imported = 0;
  const skipMemory = opts?.skipMemoryCategoryIds ?? new Set<string>();

  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = db.batch();
    const chunk = rows.slice(i, i + CHUNK);
    const merchantUpdates = new Map<string, { display: string; categoryId: string }>();

    for (const row of chunk) {
      const ref = db.collection(`users/${uid}/books/${bookId}/transactions`).doc();
      batch.set(ref, {
        type: "expense",
        amount: row.amount,
        categoryId: row.categoryId,
        merchantDisplay: row.merchantDisplay,
        merchantNormalized: row.merchantNormalized,
        date: Timestamp.fromDate(row.date),
        tags: [],
        source: "max",
        sourceKey: row.sourceKey,
        createdAt: Timestamp.now(),
      });
      // Don't bake "unknown" into auto-memory — next sync should still try AI.
      if (!skipMemory.has(row.categoryId)) {
        merchantUpdates.set(row.merchantNormalized, {
          display: row.merchantDisplay,
          categoryId: row.categoryId,
        });
      }
      imported++;
    }

    for (const [normalized, m] of merchantUpdates) {
      const mRef = db.doc(`users/${uid}/books/${bookId}/merchants/${normalized}`);
      batch.set(
        mRef,
        {
          displayName: m.display,
          defaultCategoryId: m.categoryId,
          lastSeenAt: Timestamp.now(),
        },
        { merge: true }
      );
    }

    await batch.commit();
  }

  return imported;
}

export function pickDefaultCategoryId(categories: CategoryDoc[]): string {
  const expense = categories.filter((c) => c.type === "expense");
  return expense[0]?.id ?? categories[0]?.id ?? "uncategorized";
}

/** Fallback bucket when memory + AI both miss — prefer Other/Unknown, never first expense. */
export function pickUnknownCategoryId(categories: CategoryDoc[]): string {
  const expense = categories.filter((c) => c.type === "expense");
  const match = expense.find((c) => {
    const en = (c.nameEn ?? "").trim().toLowerCase();
    const he = (c.name ?? "").trim();
    return (
      en === "other" ||
      en === "unknown" ||
      he === "אחר" ||
      he === "לא ידוע"
    );
  });
  return match?.id ?? expense[expense.length - 1]?.id ?? "uncategorized";
}

export { normalizeMerchant };
