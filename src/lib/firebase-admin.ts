import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getApps, initializeApp, cert, applicationDefault, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

function resolveServiceAccountJson(): string | null {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (inline) return inline;

  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE?.trim();
  if (!filePath) return null;
  const absolute = resolve(process.cwd(), filePath);
  if (!existsSync(absolute)) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_KEY_FILE not found: ${absolute}`);
  }
  return readFileSync(absolute, "utf8");
}

function initAdminApp(): App {
  if (getApps().length) return getApps()[0]!;

  const serviceAccountJson = resolveServiceAccountJson();
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
