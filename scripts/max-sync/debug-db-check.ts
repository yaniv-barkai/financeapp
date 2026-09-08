import "./load-env.js";
import { appendFileSync } from "node:fs";
import { getDb, getMaxSyncSettings } from "./firebase.js";
import { requireEnv } from "./utils.js";

const LOG = "/Users/yanivbarkai/finance_app/.cursor/debug-0e6593.log";
const SESSION = "0e6593";

function dbg(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  // #region agent log
  const payload = {
    sessionId: SESSION,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
    runId: "db-check",
  };
  appendFileSync(LOG, JSON.stringify(payload) + "\n");
  fetch("http://127.0.0.1:7319/ingest/3fe75c29-122c-4137-9135-f8c7230bc020", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": SESSION },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // #endregion
}

async function main() {
  const uid = requireEnv("SYNC_USER_UID");
  const bookId = requireEnv("SYNC_BOOK_ID");
  const settings = await getMaxSyncSettings(uid);

  dbg("E", "debug-db-check.ts:settings", "maxSync settings", {
    bookId: settings?.bookId ?? null,
    envBookId: bookId,
    lastSyncStatus: settings?.lastSyncStatus ?? null,
    lastSyncCount: settings?.lastSyncCount ?? null,
    lastSyncAt: settings?.lastSyncAt?.toDate?.()?.toISOString?.() ?? null,
    lastSyncError: settings?.lastSyncError ? String(settings.lastSyncError).slice(0, 200) : null,
  });

  const snap = await getDb()
    .collection(`users/${uid}/books/${bookId}/transactions`)
    .where("source", "==", "max")
    .get();

  const byKey = new Map<string, number>();
  let missingKey = 0;
  const samples: Array<{ id: string; sourceKey: string | null; amount: number; merchant: string }> = [];

  for (const doc of snap.docs) {
    const d = doc.data();
    const key = (d.sourceKey as string | undefined) ?? null;
    if (!key) missingKey++;
    else byKey.set(key, (byKey.get(key) ?? 0) + 1);
    if (samples.length < 5) {
      samples.push({
        id: doc.id,
        sourceKey: key,
        amount: d.amount as number,
        merchant: String(d.merchantDisplay ?? "").slice(0, 40),
      });
    }
  }

  const duplicateKeys = [...byKey.entries()].filter(([, n]) => n > 1);
  dbg("D", "debug-db-check.ts:dupes", "max transactions duplicate scan", {
    totalMaxTx: snap.size,
    uniqueSourceKeys: byKey.size,
    missingSourceKey: missingKey,
    duplicateKeyCount: duplicateKeys.length,
    duplicateExamples: duplicateKeys.slice(0, 10).map(([k, n]) => ({ key: k, count: n })),
    samples,
  });

  console.log(
    JSON.stringify(
      {
        settings: {
          status: settings?.lastSyncStatus,
          count: settings?.lastSyncCount,
          at: settings?.lastSyncAt?.toDate?.()?.toISOString?.(),
          error: settings?.lastSyncError ?? null,
        },
        totalMaxTx: snap.size,
        uniqueSourceKeys: byKey.size,
        missingSourceKey: missingKey,
        duplicateKeyCount: duplicateKeys.length,
        duplicateExamples: duplicateKeys.slice(0, 10).map(([k, n]) => ({ key: k, count: n })),
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
