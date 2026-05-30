import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { Transaction, TransactionType } from "../types";
import { normalizemerchant } from "../utils";

function txRef(uid: string, bookId: string) {
  return collection(db, "users", uid, "books", bookId, "transactions");
}

export async function getTransactionsByMonth(
  uid: string,
  bookId: string,
  start: Date,
  end: Date
): Promise<Transaction[]> {
  const snap = await getDocs(
    query(
      txRef(uid, bookId),
      where("date", ">=", Timestamp.fromDate(start)),
      where("date", "<=", Timestamp.fromDate(end)),
      orderBy("date", "desc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction);
}

export async function getAllTransactions(
  uid: string,
  bookId: string
): Promise<Transaction[]> {
  const snap = await getDocs(
    query(txRef(uid, bookId), orderBy("date", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction);
}

export async function addTransaction(
  uid: string,
  bookId: string,
  data: Omit<Transaction, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(txRef(uid, bookId), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTransaction(
  uid: string,
  bookId: string,
  txId: string,
  data: Partial<Omit<Transaction, "id" | "createdAt">>
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "books", bookId, "transactions", txId), data);
}

export async function deleteTransaction(
  uid: string,
  bookId: string,
  txId: string
): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "books", bookId, "transactions", txId));
}

export async function transferTransaction(
  uid: string,
  fromBookId: string,
  toBookId: string,
  tx: Transaction
): Promise<void> {
  const batch = writeBatch(db);
  const newRef = doc(txRef(uid, toBookId));
  const { id: _id, ...txData } = tx;
  batch.set(newRef, txData);
  batch.delete(doc(db, "users", uid, "books", fromBookId, "transactions", tx.id));
  await batch.commit();
}

export interface ImportableTransaction {
  type: TransactionType;
  amount: number;
  categoryId: string;
  merchantDisplay?: string;
  merchantNormalized?: string;
  date: Timestamp;
  note?: string;
  tags: string[];
}

export async function batchImportTransactions(
  uid: string,
  bookId: string,
  rows: ImportableTransaction[],
  merchantUpdates: Array<{
    normalized: string;
    display: string;
    categoryId: string;
  }>
): Promise<void> {
  const CHUNK = 400;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = writeBatch(db);
    const chunk = rows.slice(i, i + CHUNK);
    for (const row of chunk) {
      const ref = doc(txRef(uid, bookId));
      batch.set(ref, { ...row, createdAt: serverTimestamp() });
    }
    for (const m of merchantUpdates) {
      const mRef = doc(
        db,
        "users",
        uid,
        "books",
        bookId,
        "merchants",
        m.normalized
      );
      batch.set(
        mRef,
        {
          displayName: m.display,
          defaultCategoryId: m.categoryId,
          lastSeenAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
  }
}

export function normalizeMerchantForImport(name: string): string {
  return normalizemerchant(name);
}
