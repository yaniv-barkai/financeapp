import "./load-env.js";
import { appendFileSync } from "node:fs";
import { getDb } from "./firebase.js";
import { requireEnv } from "./utils.js";

const LOG = "/Users/yanivbarkai/finance_app/.cursor/debug-0e6593.log";

function dbg(message: string, data: Record<string, unknown>) {
  // #region agent log
  const payload = {
    sessionId: "0e6593",
    runId: "cleanup-dupes",
    hypothesisId: "D",
    location: "debug-cleanup-dupes.ts",
    message,
    data,
    timestamp: Date.now(),
  };
  appendFileSync(LOG, JSON.stringify(payload) + "\n");
  fetch("http://127.0.0.1:7319/ingest/3fe75c29-122c-4137-9135-f8c7230bc020", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "0e6593" },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // #endregion
}

async function main() {
  const uid = requireEnv("SYNC_USER_UID");
  const bookId = requireEnv("SYNC_BOOK_ID");
  const col = getDb().collection(`users/${uid}/books/${bookId}/transactions`);
  const snap = await col.where("source", "==", "max").get();

  const byKey = new Map<
    string,
    Array<{ id: string; createdAtMs: number }>
  >();

  for (const doc of snap.docs) {
    const data = doc.data();
    const key = data.sourceKey as string | undefined;
    if (!key) continue;
    const createdAtMs = data.createdAt?.toMillis?.() ?? 0;
    const list = byKey.get(key) ?? [];
    list.push({ id: doc.id, createdAtMs });
    byKey.set(key, list);
  }

  const toDelete: string[] = [];
  for (const [, docs] of byKey) {
    if (docs.length < 2) continue;
    docs.sort((a, b) => a.createdAtMs - b.createdAtMs);
    // keep first, delete the rest
    for (const d of docs.slice(1)) toDelete.push(d.id);
  }

  dbg("cleanup plan", {
    totalMaxTx: snap.size,
    uniqueKeys: byKey.size,
    deleteCount: toDelete.length,
  });

  const CHUNK = 400;
  for (let i = 0; i < toDelete.length; i += CHUNK) {
    const batch = getDb().batch();
    for (const id of toDelete.slice(i, i + CHUNK)) {
      batch.delete(col.doc(id));
    }
    await batch.commit();
  }

  dbg("cleanup done", { deleted: toDelete.length });
  console.log(JSON.stringify({ deleted: toDelete.length, remaining: snap.size - toDelete.length }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
