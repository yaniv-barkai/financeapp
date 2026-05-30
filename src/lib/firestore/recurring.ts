import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { Recurring } from "../types";
import { addDays, addMonths, addYears, isBefore, startOfDay } from "date-fns";

function recurringRef(uid: string, bookId: string) {
  return collection(db, "users", uid, "books", bookId, "recurring");
}

export async function getRecurring(
  uid: string,
  bookId: string
): Promise<Recurring[]> {
  const snap = await getDocs(recurringRef(uid, bookId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Recurring);
}

export async function addRecurring(
  uid: string,
  bookId: string,
  data: Omit<Recurring, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(recurringRef(uid, bookId), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateRecurring(
  uid: string,
  bookId: string,
  rid: string,
  data: Partial<Omit<Recurring, "id" | "createdAt">>
): Promise<void> {
  await updateDoc(
    doc(db, "users", uid, "books", bookId, "recurring", rid),
    data
  );
}

export async function deleteRecurring(
  uid: string,
  bookId: string,
  rid: string
): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "books", bookId, "recurring", rid));
}

function nextDate(current: Date, cadence: Recurring["cadence"]): Date {
  switch (cadence) {
    case "weekly":
      return addDays(current, 7);
    case "monthly":
      return addMonths(current, 1);
    case "yearly":
      return addYears(current, 1);
  }
}

export async function reconcileRecurring(
  uid: string,
  bookId: string
): Promise<number> {
  const recurrings = await getRecurring(uid, bookId);
  const today = startOfDay(new Date());
  const due = recurrings.filter(
    (r) => r.active && isBefore(r.nextRunDate.toDate(), today)
  );
  if (due.length === 0) return 0;

  const txRef = collection(db, "users", uid, "books", bookId, "transactions");
  const batch = writeBatch(db);
  let count = 0;

  for (const r of due) {
    let runDate = r.nextRunDate.toDate();
    while (isBefore(runDate, today)) {
      const newTx = doc(txRef);
      batch.set(newTx, {
        type: r.type,
        amount: r.amount,
        categoryId: r.categoryId,
        merchantDisplay: r.merchantDisplay ?? null,
        merchantNormalized: null,
        date: Timestamp.fromDate(runDate),
        note: r.note ?? null,
        tags: [],
        recurringId: r.id,
        createdAt: serverTimestamp(),
      });
      runDate = nextDate(runDate, r.cadence);
      count++;
    }
    const rDocRef = doc(
      db,
      "users",
      uid,
      "books",
      bookId,
      "recurring",
      r.id
    );
    batch.update(rDocRef, {
      nextRunDate: Timestamp.fromDate(runDate),
    });
  }

  await batch.commit();
  return count;
}
