import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { Tag } from "../types";

function tagsRef(uid: string, bookId: string) {
  return collection(db, "users", uid, "books", bookId, "tags");
}

export async function getTags(uid: string, bookId: string): Promise<Tag[]> {
  const snap = await getDocs(tagsRef(uid, bookId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Tag);
}

export async function addTag(
  uid: string,
  bookId: string,
  name: string,
  color = "#6b7280"
): Promise<string> {
  const ref = await addDoc(tagsRef(uid, bookId), { name, color });
  return ref.id;
}

export async function updateTag(
  uid: string,
  bookId: string,
  tagId: string,
  data: Partial<Omit<Tag, "id">>
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "books", bookId, "tags", tagId), data);
}

export async function deleteTag(
  uid: string,
  bookId: string,
  tagId: string
): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "books", bookId, "tags", tagId));
}
