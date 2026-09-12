/**
 * Grant admin custom claim and backfill accountRegistry for an existing user.
 *
 * Usage:
 *   npx tsx scripts/grant-admin.ts --email you@example.com
 *   npx tsx scripts/grant-admin.ts --uid FIREBASE_UID
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_KEY_FILE in .env.local
 * After running, the user must sign out and sign in (or refresh ID token) to pick up the claim.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

function resolveServiceAccountJson(): string {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (inline) return inline;
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE?.trim();
  if (!filePath) {
    throw new Error("Set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_KEY_FILE");
  }
  const absolute = resolve(process.cwd(), filePath);
  if (!existsSync(absolute)) {
    throw new Error(`Service account file not found: ${absolute}`);
  }
  return readFileSync(absolute, "utf8");
}

function parseArgs() {
  const args = process.argv.slice(2);
  let email: string | undefined;
  let uid: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) email = args[++i];
    else if (args[i] === "--uid" && args[i + 1]) uid = args[++i];
  }
  return { email, uid };
}

async function main() {
  const { email, uid } = parseArgs();
  if (!email && !uid) {
    console.error("Usage: npx tsx scripts/grant-admin.ts --email you@example.com");
    console.error("   or: npx tsx scripts/grant-admin.ts --uid FIREBASE_UID");
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(resolveServiceAccountJson())) });
  }

  const auth = getAuth();
  const user = email ? await auth.getUserByEmail(email) : await auth.getUser(uid!);

  await auth.setCustomUserClaims(user.uid, {
    ...(user.customClaims ?? {}),
    admin: true,
  });

  const db = getFirestore();
  await db.collection("accountRegistry").doc(user.uid).set(
    {
      status: "active",
      email: user.email ?? email ?? null,
      displayName: user.displayName ?? null,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      createdBy: "grant-admin-script",
    },
    { merge: true }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        uid: user.uid,
        email: user.email ?? null,
        admin: true,
        accountRegistry: "active",
        note: "Sign out and sign in again to refresh the ID token claim.",
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
