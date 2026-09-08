import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { Category, MonthlyBudget } from "../types";
import { assertOwner } from "./auth";
import { getAllLimits } from "./categories";
import { getPrevMonthKey } from "../utils";

function budgetRef(uid: string, bookId: string, monthKey: string) {
  assertOwner(uid);
  return doc(db, "users", uid, "books", bookId, "monthlyBudgets", monthKey);
}

export async function getMonthlyBudget(
  uid: string,
  bookId: string,
  monthKey: string
): Promise<MonthlyBudget | null> {
  const snap = await getDoc(budgetRef(uid, bookId, monthKey));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    monthKey,
    amounts: (data.amounts as Record<string, number>) ?? {},
    updatedAt: data.updatedAt as Timestamp | undefined,
    createdAt: data.createdAt as Timestamp | undefined,
  };
}

export async function isMonthlyBudgetSet(
  uid: string,
  bookId: string,
  monthKey: string
): Promise<boolean> {
  const budget = await getMonthlyBudget(uid, bookId, monthKey);
  if (!budget) return false;
  return Object.values(budget.amounts).some((v) => v > 0);
}

export async function saveMonthlyBudget(
  uid: string,
  bookId: string,
  monthKey: string,
  amounts: Record<string, number>
): Promise<void> {
  assertOwner(uid);
  const cleaned: Record<string, number> = {};
  for (const [catId, amount] of Object.entries(amounts)) {
    if (typeof amount === "number" && amount > 0 && Number.isFinite(amount)) {
      cleaned[catId] = Math.round(amount * 100) / 100;
    }
  }
  const ref = budgetRef(uid, bookId, monthKey);
  const existing = await getDoc(ref);
  await setDoc(
    ref,
    {
      amounts: cleaned,
      updatedAt: serverTimestamp(),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );
}

/**
 * Resolve category limits for a month.
 * Preference: monthlyBudgets/{month} → previous month budget → legacy category limits.
 */
export async function getLimitsForMonth(
  uid: string,
  bookId: string,
  monthKey: string,
  categories: Category[]
): Promise<{ limits: Record<string, number>; source: "month" | "previous" | "legacy" | "none" }> {
  const current = await getMonthlyBudget(uid, bookId, monthKey);
  if (current && Object.values(current.amounts).some((v) => v > 0)) {
    return { limits: { ...current.amounts }, source: "month" };
  }

  const prev = await getMonthlyBudget(uid, bookId, getPrevMonthKey(monthKey));
  if (prev && Object.values(prev.amounts).some((v) => v > 0)) {
    return { limits: { ...prev.amounts }, source: "previous" };
  }

  const legacy = await getAllLimits(uid, bookId, categories);
  if (Object.keys(legacy).length > 0) {
    return { limits: legacy, source: "legacy" };
  }

  return { limits: {}, source: "none" };
}

/** Load amounts for the editor: exact month doc, else seed from previous/legacy. */
export async function getBudgetEditorSeed(
  uid: string,
  bookId: string,
  monthKey: string,
  categories: Category[]
): Promise<{ amounts: Record<string, number>; isSet: boolean; seededFrom: "month" | "previous" | "legacy" | "none" }> {
  const current = await getMonthlyBudget(uid, bookId, monthKey);
  if (current && Object.keys(current.amounts).length > 0) {
    return {
      amounts: { ...current.amounts },
      isSet: Object.values(current.amounts).some((v) => v > 0),
      seededFrom: "month",
    };
  }

  const prev = await getMonthlyBudget(uid, bookId, getPrevMonthKey(monthKey));
  if (prev && Object.values(prev.amounts).some((v) => v > 0)) {
    return { amounts: { ...prev.amounts }, isSet: false, seededFrom: "previous" };
  }

  const legacy = await getAllLimits(uid, bookId, categories);
  if (Object.keys(legacy).length > 0) {
    return { amounts: legacy, isSet: false, seededFrom: "legacy" };
  }

  return { amounts: {}, isSet: false, seededFrom: "none" };
}
