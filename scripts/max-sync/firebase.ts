import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { resolveFirebaseServiceAccountKey } from "./load-env.js";

export function getDb() {
  if (!getApps().length) {
    const keyJson = resolveFirebaseServiceAccountKey();
    initializeApp({ credential: cert(JSON.parse(keyJson)) });
  }
  return getFirestore();
}

export interface MaxSyncSettings {
  bookId: string;
  lastSyncAt?: FirebaseFirestore.Timestamp;
  lastSyncStatus?: "ok" | "error" | "running";
  lastSyncError?: string;
  lastSyncCount?: number;
}

export async function getMaxSyncSettings(uid: string): Promise<MaxSyncSettings | null> {
  const snap = await getDb().doc(`users/${uid}`).get();
  if (!snap.exists) return null;
  const data = snap.data();
  return (data?.maxSync as MaxSyncSettings | undefined) ?? null;
}

export async function updateMaxSyncSettings(
  uid: string,
  patch: Partial<MaxSyncSettings>
): Promise<void> {
  await getDb().doc(`users/${uid}`).set({ maxSync: patch }, { merge: true });
}

export async function setMaxSyncRunning(uid: string, bookId: string): Promise<void> {
  await getDb().doc(`users/${uid}`).set(
    {
      maxSync: {
        bookId,
        lastSyncStatus: "running",
      },
    },
    { merge: true }
  );
}

export async function setMaxSyncResult(
  uid: string,
  bookId: string,
  result: {
    status: "ok" | "error";
    count?: number;
    error?: string;
  }
): Promise<void> {
  const maxSync: Record<string, unknown> = {
    bookId,
    lastSyncStatus: result.status,
    lastSyncCount: result.count ?? 0,
  };
  // Only advance lastSyncAt on success so failed runs don't shrink the scrape window.
  if (result.status === "ok") {
    maxSync.lastSyncAt = Timestamp.now();
  }
  if (result.error) {
    maxSync.lastSyncError = result.error;
  } else {
    maxSync.lastSyncError = FieldValue.delete();
  }
  await getDb().doc(`users/${uid}`).set({ maxSync }, { merge: true });
}
