import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { UserSettings } from "../types";
import { assertOwner } from "./auth";

export async function getUserSettings(uid: string): Promise<UserSettings | null> {
  assertOwner(uid);
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as UserSettings;
}

export async function setUserSettings(
  uid: string,
  data: Partial<Omit<UserSettings, "createdAt">>
): Promise<void> {
  assertOwner(uid);
  await setDoc(doc(db, "users", uid), { ...data }, { merge: true });
}

export async function initUserSettings(
  uid: string,
  defaultBookId: string
): Promise<void> {
  assertOwner(uid);
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      defaultBookId,
      currency: "USD",
      alertSettings: { emailEnabled: true, thresholds: [80, 100] },
      createdAt: serverTimestamp(),
    });
  }
}
