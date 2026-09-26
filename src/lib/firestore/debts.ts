import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { Debt } from "../types";
import { assertOwner } from "./auth";

function debtsRef(uid: string, bookId: string) {
  assertOwner(uid);
  return collection(db, "users", uid, "books", bookId, "debts");
}

/** Firestore rejects undefined field values — strip them before write. */
function withoutUndefined<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as T;
}

export async function getDebts(uid: string, bookId: string): Promise<Debt[]> {
  const snap = await getDocs(debtsRef(uid, bookId));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: (data.name as string) ?? "",
      balance: Number(data.balance) || 0,
      monthlyPayment: Number(data.monthlyPayment) || 0,
      forcePhase1: Boolean(data.forcePhase1),
      recurringId: data.recurringId as string | undefined,
      transactionIds: (data.transactionIds as string[]) ?? [],
      matchMerchants: (data.matchMerchants as string[]) ?? [],
      categoryId: data.categoryId as string | undefined,
      note: data.note as string | undefined,
      status: (data.status as Debt["status"]) ?? "open",
      createdAt: data.createdAt,
    } as Debt;
  });
}

export async function addDebt(
  uid: string,
  bookId: string,
  data: Omit<Debt, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(
    debtsRef(uid, bookId),
    withoutUndefined({
      ...data,
      createdAt: serverTimestamp(),
    })
  );
  return ref.id;
}

export async function updateDebt(
  uid: string,
  bookId: string,
  debtId: string,
  data: Partial<Omit<Debt, "id" | "createdAt">>
): Promise<void> {
  assertOwner(uid);
  await updateDoc(
    doc(db, "users", uid, "books", bookId, "debts", debtId),
    withoutUndefined(data)
  );
}

export async function deleteDebt(
  uid: string,
  bookId: string,
  debtId: string
): Promise<void> {
  assertOwner(uid);
  await deleteDoc(doc(db, "users", uid, "books", bookId, "debts", debtId));
}
