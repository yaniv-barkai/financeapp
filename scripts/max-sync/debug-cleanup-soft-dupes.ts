import "./load-env.js";
import { appendFileSync } from "node:fs";
import { getDb } from "./firebase.js";
import { israelCalendarDay, requireEnv } from "./utils.js";

const LOG = "/Users/yanivbarkai/finance_app/.cursor/debug-18ad6c.log";

function dbg(message: string, data: Record<string, unknown>) {
  // #region agent log
  const payload = {
    sessionId: "18ad6c",
    runId: "cleanup-soft-dupes",
    hypothesisId: "B",
    location: "debug-cleanup-soft-dupes.ts",
    message,
    data,
    timestamp: Date.now(),
  };
  try {
    appendFileSync(LOG, JSON.stringify(payload) + "\n");
  } catch {
    /* ignore */
  }
  fetch("http://127.0.0.1:7319/ingest/3fe75c29-122c-4137-9135-f8c7230bc020", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "18ad6c" },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // #endregion
}

async function main() {
  const uid = requireEnv("SYNC_USER_UID");
  const bookId = requireEnv("SYNC_BOOK_ID");
  const col = getDb().collection(`users/${uid}/books/${bookId}/transactions`);
  const snap = await col.where("source", "==", "max").get();

  type Row = {
    id: string;
    softKey: string;
    sourceKey: string | null;
    createdAtMs: number;
    dateIso: string;
  };

  const bySoft = new Map<string, Row[]>();

  for (const doc of snap.docs) {
    const d = doc.data();
    const date = d.date?.toDate?.() as Date | undefined;
    if (!date) continue;
    const amount = Number(d.amount);
    const merchant = String(d.merchantNormalized ?? "");
    if (!merchant || Number.isNaN(amount)) continue;
    const softKey = `${israelCalendarDay(date)}|${amount.toFixed(2)}|${merchant}`;
    const list = bySoft.get(softKey) ?? [];
    list.push({
      id: doc.id,
      softKey,
      sourceKey: (d.sourceKey as string | undefined) ?? null,
      createdAtMs: d.createdAt?.toMillis?.() ?? 0,
      dateIso: date.toISOString(),
    });
    bySoft.set(softKey, list);
  }

  const toDelete: string[] = [];
  const examples: Array<Record<string, unknown>> = [];
  for (const [softKey, docs] of bySoft) {
    if (docs.length < 2) continue;
    docs.sort((a, b) => a.createdAtMs - b.createdAtMs);
    // Keep earliest import; drop later copies (last-day re-imports).
    for (const d of docs.slice(1)) toDelete.push(d.id);
    if (examples.length < 8) {
      examples.push({
        softKey,
        keep: docs[0],
        drop: docs.slice(1),
      });
    }
  }

  dbg("cleanup plan", {
    totalMaxTx: snap.size,
    softGroups: bySoft.size,
    deleteCount: toDelete.length,
    examples,
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
  console.log(
    JSON.stringify(
      { deleted: toDelete.length, remaining: snap.size - toDelete.length, examples },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
