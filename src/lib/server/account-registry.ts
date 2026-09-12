import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase-admin";

export type AccountRegistryStatus = "active" | "disabled";

export interface AccountRegistryDoc {
  status: AccountRegistryStatus;
  email?: string;
  displayName?: string;
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
  createdBy?: string;
}

export function accountRegistryRef(uid: string) {
  return getAdminFirestore().collection("accountRegistry").doc(uid);
}

export async function getAccountRegistry(
  uid: string
): Promise<(AccountRegistryDoc & { id: string }) | null> {
  const snap = await accountRegistryRef(uid).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as AccountRegistryDoc) };
}

export async function upsertAccountRegistry(
  uid: string,
  data: {
    status: AccountRegistryStatus;
    email?: string;
    displayName?: string;
    createdBy?: string;
  }
): Promise<void> {
  const ref = accountRegistryRef(uid);
  const existing = await ref.get();
  const payload: Record<string, unknown> = {
    status: data.status,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (data.email !== undefined) payload.email = data.email;
  if (data.displayName !== undefined) payload.displayName = data.displayName;
  if (!existing.exists) {
    payload.createdAt = FieldValue.serverTimestamp();
    if (data.createdBy) payload.createdBy = data.createdBy;
  }
  await ref.set(payload, { merge: true });
}

export async function deleteAccountRegistry(uid: string): Promise<void> {
  await accountRegistryRef(uid).delete();
}

/** Deletes the user's finance subtree without returning document contents. */
export async function deleteUserFinanceData(uid: string): Promise<void> {
  const db = getAdminFirestore();
  const userRef = db.collection("users").doc(uid);
  await db.recursiveDelete(userRef);
}
