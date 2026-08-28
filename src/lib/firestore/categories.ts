import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { BudgetPeriod, Category, CategoryLimit } from "../types";
import { assertOwner } from "./auth";

function toMonthlyLimit(amount: number, period: BudgetPeriod): number {
  return period === "yearly" ? amount / 12 : amount;
}

function parseLimitDoc(data: Record<string, unknown>): CategoryLimit {
  if (data.budgetAmount !== undefined) {
    const amount = data.budgetAmount as number;
    const period = (data.budgetPeriod as BudgetPeriod) ?? "monthly";
    return { budgetAmount: amount, budgetPeriod: period, monthlyLimit: toMonthlyLimit(amount, period) };
  }
  // Backward compat: old docs only had monthlyLimit
  const legacy = (data.monthlyLimit as number) ?? 0;
  return { budgetAmount: legacy, budgetPeriod: "monthly", monthlyLimit: legacy };
}

function catsRef(uid: string, bookId: string) {
  assertOwner(uid);
  return collection(db, "users", uid, "books", bookId, "categories");
}

export async function getCategories(
  uid: string,
  bookId: string
): Promise<Category[]> {
  const snap = await getDocs(
    query(catsRef(uid, bookId), orderBy("order"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category);
}

export async function addCategory(
  uid: string,
  bookId: string,
  cat: Omit<Category, "id">
): Promise<string> {
  const ref = await addDoc(catsRef(uid, bookId), cat);
  return ref.id;
}

export async function updateCategory(
  uid: string,
  bookId: string,
  catId: string,
  data: Partial<Omit<Category, "id">>
): Promise<void> {
  assertOwner(uid);
  await updateDoc(doc(db, "users", uid, "books", bookId, "categories", catId), data);
}

export async function updateCategoryOrders(
  uid: string,
  bookId: string,
  orderedIds: string[]
): Promise<void> {
  assertOwner(uid);
  await Promise.all(
    orderedIds.map((catId, idx) =>
      updateDoc(doc(db, "users", uid, "books", bookId, "categories", catId), { order: idx })
    )
  );
}

export async function deleteCategory(
  uid: string,
  bookId: string,
  catId: string
): Promise<void> {
  assertOwner(uid);
  await deleteDoc(doc(db, "users", uid, "books", bookId, "categories", catId));
}

export async function getCategoryLimit(
  uid: string,
  bookId: string,
  catId: string
): Promise<CategoryLimit | null> {
  assertOwner(uid);
  const { getDoc } = await import("firebase/firestore");
  const ref = doc(
    db,
    "users",
    uid,
    "books",
    bookId,
    "categories",
    catId,
    "limits",
    "default"
  );
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return parseLimitDoc(snap.data() as Record<string, unknown>);
}

export async function setCategoryLimit(
  uid: string,
  bookId: string,
  catId: string,
  budgetAmount: number,
  budgetPeriod: BudgetPeriod = "monthly"
): Promise<void> {
  assertOwner(uid);
  const { setDoc } = await import("firebase/firestore");
  const ref = doc(
    db,
    "users",
    uid,
    "books",
    bookId,
    "categories",
    catId,
    "limits",
    "default"
  );
  await setDoc(ref, { budgetAmount, budgetPeriod });
}

export async function removeCategoryLimit(
  uid: string,
  bookId: string,
  catId: string
): Promise<void> {
  assertOwner(uid);
  const { deleteDoc: del } = await import("firebase/firestore");
  const ref = doc(
    db,
    "users",
    uid,
    "books",
    bookId,
    "categories",
    catId,
    "limits",
    "default"
  );
  await del(ref);
}

export async function getAllLimits(
  uid: string,
  bookId: string,
  categories: Category[]
): Promise<Record<string, number>> {
  assertOwner(uid);
  const details = await getAllLimitDetails(uid, bookId, categories);
  return Object.fromEntries(
    Object.entries(details).map(([catId, d]) => [catId, d.monthlyLimit])
  );
}

export async function getAllLimitDetails(
  uid: string,
  bookId: string,
  categories: Category[]
): Promise<Record<string, CategoryLimit>> {
  const { getDoc } = await import("firebase/firestore");
  const results: Record<string, CategoryLimit> = {};
  await Promise.all(
    categories
      .map(async (c) => {
        const ref = doc(
          db,
          "users",
          uid,
          "books",
          bookId,
          "categories",
          c.id,
          "limits",
          "default"
        );
        const snap = await getDoc(ref);
        if (snap.exists()) {
          results[c.id] = parseLimitDoc(snap.data() as Record<string, unknown>);
        }
      })
  );
  return results;
}
