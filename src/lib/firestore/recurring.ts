import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { Recurring } from "../types";
import { assertOwner } from "./auth";
import {
  addDays,
  addMonths,
  addYears,
  getISOWeek,
  getMonth,
  getYear,
  isBefore,
  startOfDay,
} from "date-fns";

function recurringRef(uid: string, bookId: string) {
  assertOwner(uid);
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
  assertOwner(uid);
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
  assertOwner(uid);
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

/** Normalize a recurring amount to a monthly equivalent for budget math. */
export function toMonthlyRecurringAmount(
  amount: number,
  cadence: Recurring["cadence"]
): number {
  switch (cadence) {
    case "weekly":
      return (amount * 52) / 12;
    case "monthly":
      return amount;
    case "yearly":
      return amount / 12;
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

/** Advance nextRunDate past a boundary so the same period isn't re-booked. */
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
