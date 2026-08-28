import { getApps, initializeApp, cert, applicationDefault, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

function initAdminApp(): App {
  if (getApps().length) return getApps()[0]!;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    return initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("Firebase Admin is not configured");
  }

  try {
    return initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  } catch {
    return initializeApp({ projectId });
  }
}

export function getAdminFirestore(): Firestore {
  initAdminApp();
  return getFirestore();
}

export async function verifyIdToken(token: string) {
  initAdminApp();
  return getAuth().verifyIdToken(token);
}
