import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { Book } from "../types";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "../seeds";

function booksRef(uid: string) {
  return collection(db, "users", uid, "books");
}

export async function getBooks(uid: string): Promise<Book[]> {
  const snap = await getDocs(query(booksRef(uid), orderBy("createdAt")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Book);
}

export async function createBook(
  uid: string,
  name: string,
  color = "#3b82f6",
  currency = "USD"
): Promise<string> {
  const ref = await addDoc(booksRef(uid), {
    name,
    color,
    currency,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateBook(
  uid: string,
  bookId: string,
  data: Partial<Pick<Book, "name" | "color" | "currency">>
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "books", bookId), data);
}

export async function deleteBook(uid: string, bookId: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "books", bookId));
}

export async function seedDefaultBook(uid: string): Promise<string> {
  const bookId = await createBook(uid, "Personal", "#3b82f6", "USD");
  const batch = writeBatch(db);
  const allSeedCategories = [
    ...DEFAULT_EXPENSE_CATEGORIES,
    ...DEFAULT_INCOME_CATEGORIES,
  ];
  for (const cat of allSeedCategories) {
    const catRef = doc(
      collection(db, "users", uid, "books", bookId, "categories")
    );
    batch.set(catRef, { ...cat });
  }
  await batch.commit();
  return bookId;
}
