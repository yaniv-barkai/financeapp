import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { UserSettings } from "../types";

export async function getUserSettings(uid: string): Promise<UserSettings | null> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as UserSettings;
}

export async function setUserSettings(
  uid: string,
  data: Partial<Omit<UserSettings, "createdAt">>
): Promise<void> {
  await setDoc(doc(db, "users", uid), { ...data }, { merge: true });
}

export async function initUserSettings(
  uid: string,
  defaultBookId: string
): Promise<void> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      defaultBookId,
      currency: "USD",
      createdAt: serverTimestamp(),
    });
  }
}
