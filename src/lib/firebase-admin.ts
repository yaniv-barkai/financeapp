import { getApps, initializeApp, cert, applicationDefault, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

function resolveServiceAccountJson(): string | null {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (inline) return inline;

  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE?.trim();
  if (!filePath) return null;

  // Lazy fs/path so Turbopack does not NFT-trace the whole project from cwd.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { existsSync, readFileSync } = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { resolve } = require("node:path") as typeof import("node:path");
  const absolute = resolve(/*turbopackIgnore: true*/ process.cwd(), filePath);
  if (!existsSync(absolute)) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_KEY_FILE not found: ${absolute}`);
  }
  return readFileSync(absolute, "utf8");
}

function parseServiceAccount(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON");
  }
}

function initAdminApp(): App {
  if (getApps().length) return getApps()[0]!;

  const serviceAccountJson = resolveServiceAccountJson();
  if (serviceAccountJson) {
    return initializeApp({ credential: cert(parseServiceAccount(serviceAccountJson)) });
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY (or FIREBASE_SERVICE_ACCOUNT_KEY_FILE locally)."
    );
  }

  try {
    return initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  } catch {
    throw new Error(
      "Firebase Admin credentials unavailable. Set FIREBASE_SERVICE_ACCOUNT_KEY for this environment."
    );
  }
}

export function getAdminApp(): App {
  return initAdminApp();
}

export function getAdminFirestore(): Firestore {
  initAdminApp();
  return getFirestore();
}

export function getAdminAuth(): Auth {
  initAdminApp();
  return getAuth();
}

export async function verifyIdToken(token: string) {
  return getAdminAuth().verifyIdToken(token);
}
