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
import { Task, TaskCostFrequency, Transaction } from "../types";
import { assertOwner } from "./auth";

function tasksRef(uid: string, bookId: string) {
  assertOwner(uid);
  return collection(db, "users", uid, "books", bookId, "tasks");
}

/** Firestore rejects undefined field values — strip them before write. */
function withoutUndefined<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as T;
}

export async function getTasks(uid: string, bookId: string): Promise<Task[]> {
  const snap = await getDocs(tasksRef(uid, bookId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Task);
}

export async function addTask(
  uid: string,
  bookId: string,
  data: Omit<Task, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(
    tasksRef(uid, bookId),
    withoutUndefined({
      ...data,
      createdAt: serverTimestamp(),
    })
  );
  return ref.id;
}

export async function updateTask(
  uid: string,
  bookId: string,
  taskId: string,
  data: Partial<Omit<Task, "id" | "createdAt">>
): Promise<void> {
  assertOwner(uid);
  await updateDoc(
    doc(db, "users", uid, "books", bookId, "tasks", taskId),
    withoutUndefined(data)
  );
}

export async function deleteTask(
  uid: string,
  bookId: string,
  taskId: string
): Promise<void> {
  assertOwner(uid);
  await deleteDoc(doc(db, "users", uid, "books", bookId, "tasks", taskId));
}

/** Sum of attached expense amounts (income ignored). */
export function taskPossibleSavings(
  transactionIds: string[],
  txById: Map<string, Transaction>
): number {
  let sum = 0;
  for (const id of transactionIds) {
    const tx = txById.get(id);
    if (tx && tx.type === "expense") sum += tx.amount;
  }
  return sum;
}

export function taskProjectedYearly(
  possibleSavings: number,
  frequency: TaskCostFrequency
): number {
  switch (frequency) {
    case "monthly":
      return possibleSavings * 12;
    case "yearly":
    case "once":
      return possibleSavings;
  }
}
