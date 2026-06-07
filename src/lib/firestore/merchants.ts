import {
  collection,
  doc,
  getDocs,
  setDoc,
  serverTimestamp,
  increment,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { Merchant, Transaction } from "../types";
import { normalizemerchant } from "../utils";

function merchantsRef(uid: string, bookId: string) {
  return collection(db, "users", uid, "books", bookId, "merchants");
}

export async function getMerchants(
  uid: string,
  bookId: string
): Promise<Merchant[]> {
  const snap = await getDocs(merchantsRef(uid, bookId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Merchant);
}

export async function upsertMerchant(
  uid: string,
  bookId: string,
  displayName: string,
  categoryId: string
): Promise<void> {
  const normalized = normalizemerchant(displayName);
  if (!normalized) return;
  const ref = doc(db, "users", uid, "books", bookId, "merchants", normalized);
  await setDoc(
    ref,
    {
      displayName,
      defaultCategoryId: categoryId,
      count: increment(1),
      lastSeenAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function lookupMerchantCategory(
  merchants: Merchant[],
  displayName: string
): string | null {
  const normalized = normalizemerchant(displayName);
  const match = merchants.find((m) => m.id === normalized);
  return match?.defaultCategoryId ?? null;
}

/**
 * Re-scans all transactions and rebuilds the merchant memory collection.
 * Use this to recover after a bug that prevented merchants from being saved,
 * or after the normalization logic changes.
 * Transactions should be sorted newest-first so the most recent category wins.
 */
export async function rebuildMerchantMemory(
  uid: string,
  bookId: string,
  transactions: Transaction[]
): Promise<number> {
  const merchantMap = new Map<string, { display: string; categoryId: string }>();

  for (const tx of transactions) {
    if (!tx.merchantDisplay || !tx.categoryId) continue;
    const normalized = normalizemerchant(tx.merchantDisplay);
    if (!normalized) continue;
    if (!merchantMap.has(normalized)) {
      merchantMap.set(normalized, {
        display: tx.merchantDisplay,
        categoryId: tx.categoryId,
      });
    }
  }

  if (merchantMap.size === 0) return 0;

  const entries = Array.from(merchantMap.entries());
  const CHUNK = 400;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const [normalized, { display, categoryId }] of entries.slice(i, i + CHUNK)) {
      const ref = doc(db, "users", uid, "books", bookId, "merchants", normalized);
      batch.set(
        ref,
        { displayName: display, defaultCategoryId: categoryId, lastSeenAt: serverTimestamp() },
        { merge: true }
      );
    }
    await batch.commit();
  }

  return merchantMap.size;
}
