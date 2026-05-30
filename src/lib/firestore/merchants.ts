import {
  collection,
  doc,
  getDocs,
  setDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "../firebase";
import { Merchant } from "../types";
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
