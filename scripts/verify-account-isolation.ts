/**
 * Live isolation proof against production Firestore + admin APIs.
 *
 * Creates two peer (non-admin) accounts with the same privileges, seeds
 * distinct financial data for each, then verifies:
 *  - each peer can read own data via the client SDK
 *  - neither peer can read/write the other's data
 *  - the admin user also cannot read peer financial data via the client SDK
 *  - admin list API returns metadata only (no ledger fields)
 *
 * Usage: npx tsx scripts/verify-account-isolation.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp as initializeAdminApp, cert, getApps } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { initializeApp as initializeClientApp, deleteApp, FirebaseApp } from "firebase/app";
import { getAuth as getClientAuth, signInWithCustomToken, signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
  setDoc,
  collection,
  getDocs,
} from "firebase/firestore";

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
  if (!filePath) throw new Error("Missing service account");
  return readFileSync(resolve(process.cwd(), filePath), "utf8");
}

function clientConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !projectId || !appId) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_* client config");
  }
  return {
    apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId,
  };
}

async function exchangeCustomToken(customToken: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY missing");
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const data = (await res.json()) as { idToken?: string; error?: { message: string } };
  if (!res.ok || !data.idToken) {
    throw new Error(data.error?.message ?? "Failed to exchange custom token");
  }
  return data.idToken;
}

const FORBIDDEN_KEYS = [
  "transaction",
  "amount",
  "merchant",
  "category",
  "budget",
  "book",
  "recurring",
  "tag",
  "alert",
  "maxSync",
  "threshold",
];

function assertNoFinancialKeys(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoFinancialKeys(v, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      const lower = k.toLowerCase();
      for (const bad of FORBIDDEN_KEYS) {
        if (lower.includes(bad.toLowerCase())) {
          throw new Error(`Financial-looking key found at ${path}.${k}`);
        }
      }
      assertNoFinancialKeys(v, `${path}.${k}`);
    }
  }
}

async function expectDenied(label: string, op: () => Promise<unknown>) {
  try {
    await op();
    throw new Error(`EXPECTED DENY but succeeded: ${label}`);
  } catch (err) {
    const code = (err as { code?: string }).code ?? "";
    const message = err instanceof Error ? err.message : String(err);
    if (
      code === "permission-denied" ||
      message.includes("permission-denied") ||
      message.includes("Missing or insufficient permissions")
    ) {
      console.log(`OK denied: ${label}`);
      return;
    }
    throw err;
  }
}

async function expectAllowed<T>(label: string, op: () => Promise<T>): Promise<T> {
  const result = await op();
  console.log(`OK allowed: ${label}`);
  return result;
}

type PeerSession = {
  uid: string;
  email: string;
  app: FirebaseApp;
  bookId: string;
  txId: string;
  secretNote: string;
};

async function createPeerSession(
  label: string,
  adminAuth: ReturnType<typeof getAdminAuth>,
  adminDb: ReturnType<typeof getAdminFirestore>
): Promise<PeerSession> {
  const stamp = Date.now();
  const email = `peer-${label}-${stamp}@example.com`;
  const user = await adminAuth.createUser({
    email,
    password: `Peer-${stamp}-${label}-secret`,
    displayName: `Peer ${label}`,
    disabled: false,
  });
  // Same privileges: active registry, NO admin claim
  await adminDb.collection("accountRegistry").doc(user.uid).set({
    status: "active",
    email,
    displayName: `Peer ${label}`,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: "verify-isolation",
  });

  const bookId = `book-${label}`;
  const txId = `tx-${label}`;
  const secretNote = `SECRET_FOR_${label.toUpperCase()}_${stamp}`;

  await adminDb.collection("users").doc(user.uid).set({
    defaultBookId: bookId,
    currency: "ILS",
    createdAt: FieldValue.serverTimestamp(),
  });
  await adminDb.collection("users").doc(user.uid).collection("books").doc(bookId).set({
    name: `${label} Personal`,
    color: "#111111",
    currency: "ILS",
    createdAt: FieldValue.serverTimestamp(),
  });
  await adminDb
    .collection("users")
    .doc(user.uid)
    .collection("books")
    .doc(bookId)
    .collection("transactions")
    .doc(txId)
    .set({
      type: "expense",
      amount: label === "a" ? 111 : 222,
      categoryId: "other",
      note: secretNote,
      tags: [],
      merchantDisplay: `Merchant ${label}`,
      createdAt: FieldValue.serverTimestamp(),
    });

  const app = initializeClientApp(clientConfig(), `peer-${label}-${stamp}`);
  const auth = getClientAuth(app);
  const custom = await adminAuth.createCustomToken(user.uid);
  await signInWithCustomToken(auth, custom);

  return { uid: user.uid, email, app, bookId, txId, secretNote };
}

async function cleanupPeer(
  peer: PeerSession | null,
  adminAuth: ReturnType<typeof getAdminAuth>,
  adminDb: ReturnType<typeof getAdminFirestore>
) {
  if (!peer) return;
  try {
    await signOut(getClientAuth(peer.app));
  } catch {
    /* ignore */
  }
  try {
    await deleteApp(peer.app);
  } catch {
    /* ignore */
  }
  await adminDb.recursiveDelete(adminDb.collection("users").doc(peer.uid)).catch(() => undefined);
  await adminDb.collection("accountRegistry").doc(peer.uid).delete().catch(() => undefined);
  await adminAuth.deleteUser(peer.uid).catch(() => undefined);
}

async function main() {
  if (!getApps().length) {
    initializeAdminApp({ credential: cert(JSON.parse(resolveServiceAccountJson())) });
  }
  const adminAuth = getAdminAuth();
  const adminDb = getAdminFirestore();
  const ownerUid = process.env.SYNC_USER_UID;
  if (!ownerUid) throw new Error("SYNC_USER_UID required");

  const base =
    process.env.VERCEL_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // --- Admin registry / claim bootstrap checks ---
  const registry = await adminDb.collection("accountRegistry").doc(ownerUid).get();
  if (!registry.exists || registry.data()?.status !== "active") {
    throw new Error("Owner accountRegistry missing or not active");
  }
  console.log("OK registry for owner");

  const owner = await adminAuth.getUser(ownerUid);
  if (owner.customClaims?.admin !== true) {
    throw new Error("Owner missing admin custom claim");
  }
  console.log("OK admin claim");

  const unauth = await fetch(`${base}/api/admin/accounts`);
  if (unauth.status !== 401) throw new Error(`Expected 401 unauth, got ${unauth.status}`);
  console.log("OK unauth admin API 401");

  const ownerIdToken = await exchangeCustomToken(
    await adminAuth.createCustomToken(ownerUid, { admin: true })
  );
  const listRes = await fetch(`${base}/api/admin/accounts`, {
    headers: { Authorization: `Bearer ${ownerIdToken}` },
  });
  const listJson = await listRes.json();
  if (!listRes.ok) throw new Error(`Admin list failed: ${JSON.stringify(listJson)}`);
  assertNoFinancialKeys(listJson);
  console.log(`OK admin list metadata-only (${listJson.accounts.length} accounts)`);

  // --- Create + delete via admin API ---
  const createEmail = `acct-create-${Date.now()}@example.com`;
  const createRes = await fetch(`${base}/api/admin/accounts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerIdToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: createEmail, displayName: "Temp User" }),
  });
  const created = await createRes.json();
  if (!createRes.ok) throw new Error(`Create failed: ${JSON.stringify(created)}`);
  if (typeof created.resetLink !== "string" || !created.resetLink.startsWith("http")) {
    throw new Error("Create response missing resetLink");
  }
  console.log("OK admin create + reset link");

  const selfDelete = await fetch(`${base}/api/admin/accounts`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${ownerIdToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uid: ownerUid }),
  });
  if (selfDelete.status !== 400) {
    throw new Error(`Expected 400 deleting self, got ${selfDelete.status}`);
  }
  console.log("OK cannot delete self");

  const delRes = await fetch(`${base}/api/admin/accounts`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${ownerIdToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uid: created.uid }),
  });
  const delJson = await delRes.json();
  if (!delRes.ok || delJson.ok !== true || Object.keys(delJson).length !== 1) {
    throw new Error(`Delete response invalid: ${JSON.stringify(delJson)}`);
  }
  console.log("OK admin delete returns { ok: true } only");

  // --- Two peer accounts, same privileges, live client SDK against production ---
  let peerA: PeerSession | null = null;
  let peerB: PeerSession | null = null;
  let adminApp: FirebaseApp | null = null;

  try {
    peerA = await createPeerSession("a", adminAuth, adminDb);
    peerB = await createPeerSession("b", adminAuth, adminDb);
    console.log(`OK created peer A (${peerA.uid}) and peer B (${peerB.uid})`);

    // Confirm neither peer has admin claim
    const aClaims = (await adminAuth.getUser(peerA.uid)).customClaims ?? {};
    const bClaims = (await adminAuth.getUser(peerB.uid)).customClaims ?? {};
    if (aClaims.admin || bClaims.admin) {
      throw new Error("Peers unexpectedly have admin claim");
    }
    console.log("OK peers have equal non-admin privileges");

    const dbA = getFirestore(peerA.app);
    const dbB = getFirestore(peerB.app);

    // Own access works
    const ownA = await expectAllowed("peer A reads own transaction", async () => {
      const snap = await getDoc(
        doc(dbA, "users", peerA!.uid, "books", peerA!.bookId, "transactions", peerA!.txId)
      );
      if (!snap.exists()) throw new Error("peer A missing own tx");
      return snap.data()!;
    });
    if (ownA.note !== peerA.secretNote || ownA.amount !== 111) {
      throw new Error("peer A own data mismatch");
    }

    const ownB = await expectAllowed("peer B reads own transaction", async () => {
      const snap = await getDoc(
        doc(dbB, "users", peerB!.uid, "books", peerB!.bookId, "transactions", peerB!.txId)
      );
      if (!snap.exists()) throw new Error("peer B missing own tx");
      return snap.data()!;
    });
    if (ownB.note !== peerB.secretNote || ownB.amount !== 222) {
      throw new Error("peer B own data mismatch");
    }

    // Cross-account denied
    await expectDenied("peer A reads peer B transaction", () =>
      getDoc(doc(dbA, "users", peerB!.uid, "books", peerB!.bookId, "transactions", peerB!.txId))
    );
    await expectDenied("peer B reads peer A transaction", () =>
      getDoc(doc(dbB, "users", peerA!.uid, "books", peerA!.bookId, "transactions", peerA!.txId))
    );
    await expectDenied("peer A reads peer B settings", () =>
      getDoc(doc(dbA, "users", peerB!.uid))
    );
    await expectDenied("peer A lists peer B transactions", () =>
      getDocs(
        collection(dbA, "users", peerB!.uid, "books", peerB!.bookId, "transactions")
      )
    );
    await expectDenied("peer A writes peer B settings", () =>
      setDoc(doc(dbA, "users", peerB!.uid), { currency: "USD" }, { merge: true })
    );
    await expectDenied("peer A writes into peer B transactions", () =>
      setDoc(
        doc(dbA, "users", peerB!.uid, "books", peerB!.bookId, "transactions", "hack"),
        { amount: 1, type: "expense", categoryId: "x", tags: [] }
      )
    );
    await expectDenied("peer A reads peer B accountRegistry", () =>
      getDoc(doc(dbA, "accountRegistry", peerB!.uid))
    );
    await expectDenied("peer A writes own accountRegistry", () =>
      setDoc(doc(dbA, "accountRegistry", peerA!.uid), { status: "active" }, { merge: true })
    );

    // Non-admin cannot hit admin API
    const peerAToken = await exchangeCustomToken(await adminAuth.createCustomToken(peerA.uid));
    const forbidden = await fetch(`${base}/api/admin/accounts`, {
      headers: { Authorization: `Bearer ${peerAToken}` },
    });
    if (forbidden.status !== 403) {
      throw new Error(`Expected 403 for non-admin, got ${forbidden.status}`);
    }
    console.log("OK non-admin admin API 403");

    // Admin signed in as client still cannot read peer financial data
    adminApp = initializeClientApp(clientConfig(), `admin-client-${Date.now()}`);
    await signInWithCustomToken(
      getClientAuth(adminApp),
      await adminAuth.createCustomToken(ownerUid, { admin: true })
    );
    const dbAdmin = getFirestore(adminApp);

    await expectAllowed("admin reads own settings", () =>
      getDoc(doc(dbAdmin, "users", ownerUid))
    );
    await expectDenied("admin client reads peer A transaction", () =>
      getDoc(
        doc(dbAdmin, "users", peerA!.uid, "books", peerA!.bookId, "transactions", peerA!.txId)
      )
    );
    await expectDenied("admin client reads peer B transaction", () =>
      getDoc(
        doc(dbAdmin, "users", peerB!.uid, "books", peerB!.bookId, "transactions", peerB!.txId)
      )
    );
    await expectDenied("admin client lists peer A books", () =>
      getDocs(collection(dbAdmin, "users", peerA!.uid, "books"))
    );
    await expectDenied("admin client reads peer A settings", () =>
      getDoc(doc(dbAdmin, "users", peerA!.uid))
    );

    // Admin list still metadata-only even with peers present
    const listWithPeers = await fetch(`${base}/api/admin/accounts`, {
      headers: { Authorization: `Bearer ${ownerIdToken}` },
    });
    const peersJson = await listWithPeers.json();
    if (!listWithPeers.ok) throw new Error(`Admin list with peers failed`);
    assertNoFinancialKeys(peersJson);
    const emails = (peersJson.accounts as Array<{ email: string | null }>).map((a) => a.email);
    if (!emails.includes(peerA.email) || !emails.includes(peerB.email)) {
      throw new Error("Admin list missing peer emails");
    }
    const serialized = JSON.stringify(peersJson);
    if (
      serialized.includes(peerA.secretNote) ||
      serialized.includes(peerB.secretNote) ||
      serialized.includes("Merchant a") ||
      serialized.includes("Merchant b")
    ) {
      throw new Error("Admin list leaked peer financial content");
    }
    console.log("OK admin list includes peers but not their financial secrets");

    console.log(JSON.stringify({ ok: true, peers: [peerA.uid, peerB.uid] }, null, 2));
  } finally {
    if (adminApp) {
      try {
        await signOut(getClientAuth(adminApp));
      } catch {
        /* ignore */
      }
      try {
        await deleteApp(adminApp);
      } catch {
        /* ignore */
      }
    }
    await cleanupPeer(peerA, adminAuth, adminDb);
    await cleanupPeer(peerB, adminAuth, adminDb);
    console.log("OK cleaned up temporary peer accounts");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
