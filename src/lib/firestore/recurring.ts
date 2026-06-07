import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { Recurring } from "../types";
import {
  addDays,
  addMonths,
  addYears,
  endOfDay,
  getISOWeek,
  getMonth,
  getYear,
  isBefore,
  startOfDay,
} from "date-fns";

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

export function recurringNextDate(
  current: Date,
  cadence: Recurring["cadence"]
): Date {
  switch (cadence) {
    case "weekly":
      return addDays(current, 7);
    case "monthly":
      return addMonths(current, 1);
    case "yearly":
      return addYears(current, 1);
  }
}

export function recurringPeriodKey(
  recurringId: string,
  date: Date,
  cadence: Recurring["cadence"]
): string {
  switch (cadence) {
    case "weekly":
      return `${recurringId}:${getYear(date)}-W${getISOWeek(date)}`;
    case "monthly":
      return `${recurringId}:${getYear(date)}-${getMonth(date)}`;
    case "yearly":
      return `${recurringId}:${getYear(date)}`;
  }
}

/** Pick a booking date inside the viewed month. */
export function bookingDateForMonth(monthStart: Date, monthEnd: Date): Date {
  const now = startOfDay(new Date());
  if (now >= monthStart && now <= monthEnd) return now;
  if (now > monthEnd) return monthEnd;
  return monthStart;
}

/** Advance nextRunDate past a boundary so reconcile won't re-book that period. */
export function advanceNextRunPast(
  nextRun: Date,
  cadence: Recurring["cadence"],
  pastDate: Date
): Date {
  let d = nextRun;
  while (!isBefore(pastDate, d)) {
    d = recurringNextDate(d, cadence);
  }
  return d;
}

export async function skipRecurringPeriod(
  uid: string,
  bookId: string,
  recurringId: string,
  periodEnd: Date
): Promise<void> {
  const recurrings = await getRecurring(uid, bookId);
  const r = recurrings.find((x) => x.id === recurringId);
  if (!r) return;
  const nextRun = advanceNextRunPast(r.nextRunDate.toDate(), r.cadence, periodEnd);
  await updateRecurring(uid, bookId, recurringId, {
    nextRunDate: Timestamp.fromDate(nextRun),
  });
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
  const cadenceById = new Map(recurrings.map((r) => [r.id, r.cadence]));
  const earliestDue = due.reduce(
    (min, r) => {
      const d = r.nextRunDate.toDate();
      return d < min ? d : min;
    },
    due[0].nextRunDate.toDate()
  );

  const existingSnap = await getDocs(
    query(
      txRef,
      where("date", ">=", Timestamp.fromDate(startOfDay(earliestDue))),
      where("date", "<=", Timestamp.fromDate(endOfDay(today)))
    )
  );
  const bookedPeriods = new Set<string>();
  for (const d of existingSnap.docs) {
    const data = d.data();
    const recurringId = data.recurringId as string | undefined;
    if (!recurringId) continue;
    const cadence = cadenceById.get(recurringId);
    if (!cadence) continue;
    bookedPeriods.add(
      recurringPeriodKey(recurringId, (data.date as Timestamp).toDate(), cadence)
    );
  }

  const batch = writeBatch(db);
  let count = 0;

  for (const r of due) {
    let runDate = r.nextRunDate.toDate();
    while (isBefore(runDate, today)) {
      const periodKey = recurringPeriodKey(r.id, runDate, r.cadence);
      if (!bookedPeriods.has(periodKey)) {
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
        bookedPeriods.add(periodKey);
        count++;
      }
      runDate = recurringNextDate(runDate, r.cadence);
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
