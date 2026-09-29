import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getAccountRegistry } from "@/lib/server/account-registry";
import {
  ApiTokenScope,
  MAX_TOKENS_PER_USER,
  displayPrefix,
  generateRawToken,
  hashToken,
  isTokenUsable,
  looksLikeApiToken,
  shouldTouchLastUsed,
} from "@/lib/server/api-token-core";

/** Admin-only collection (denied to clients by firestore.rules). Doc id = sha256(raw token). */
const COLLECTION = "apiTokens";

interface ApiTokenDoc {
  uid: string;
  name: string;
  prefix: string;
  scope: ApiTokenScope;
  createdAt: Timestamp;
  lastUsedAt?: Timestamp;
  revokedAt?: Timestamp;
}

export interface ApiTokenSummary {
  id: string;
  name: string;
  prefix: string;
  scope: ApiTokenScope;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface VerifiedApiToken {
  id: string;
  uid: string;
  scope: ApiTokenScope;
}

function tokensRef() {
  return getAdminFirestore().collection(COLLECTION);
}

function toSummary(id: string, d: ApiTokenDoc): ApiTokenSummary {
  return {
    id,
    name: d.name,
    prefix: d.prefix,
    scope: d.scope,
    createdAt: d.createdAt?.toDate().toISOString() ?? new Date(0).toISOString(),
    lastUsedAt: d.lastUsedAt ? d.lastUsedAt.toDate().toISOString() : null,
  };
}

export class ApiTokenError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiTokenError";
    this.status = status;
  }
}

export async function listApiTokens(uid: string): Promise<ApiTokenSummary[]> {
  const snap = await tokensRef().where("uid", "==", uid).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, data: doc.data() as ApiTokenDoc }))
    .filter(({ data }) => !data.revokedAt)
    .map(({ id, data }) => toSummary(id, data))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Returns the raw token exactly once; only its hash is persisted. */
export async function createApiToken(
  uid: string,
  name: string,
  scope: ApiTokenScope
): Promise<{ token: string; summary: ApiTokenSummary }> {
  const existing = await listApiTokens(uid);
  if (existing.length >= MAX_TOKENS_PER_USER) {
    throw new ApiTokenError(`Token limit reached (${MAX_TOKENS_PER_USER})`, 400);
  }

  const token = generateRawToken();
  const id = hashToken(token);
  const data: ApiTokenDoc = {
    uid,
    name,
    prefix: displayPrefix(token),
    scope,
    createdAt: Timestamp.now(),
  };
  await tokensRef().doc(id).create(data);
  return { token, summary: toSummary(id, data) };
}

export async function revokeApiToken(uid: string, id: string): Promise<void> {
  const ref = tokensRef().doc(id);
  const snap = await ref.get();
  if (!snap.exists || (snap.data() as ApiTokenDoc).uid !== uid) {
    throw new ApiTokenError("Token not found", 404);
  }
  await ref.update({ revokedAt: FieldValue.serverTimestamp() });
}

export async function verifyApiToken(raw: string | undefined): Promise<VerifiedApiToken | null> {
  if (!looksLikeApiToken(raw)) return null;

  const id = hashToken(raw);
  const ref = tokensRef().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as ApiTokenDoc;

  const registry = await getAccountRegistry(data.uid);
  const usable = isTokenUsable(
    { revokedAtMs: data.revokedAt?.toMillis() },
    registry?.status ?? null
  );
  if (!usable) return null;

  const now = Date.now();
  if (shouldTouchLastUsed(data.lastUsedAt?.toMillis(), now)) {
    await ref.update({ lastUsedAt: Timestamp.fromMillis(now) }).catch(() => {});
  }

  return { id, uid: data.uid, scope: data.scope };
}
