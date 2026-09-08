import "./load-env.js";
import { appendFileSync } from "node:fs";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { endOfMonth, startOfMonth } from "./date-fns-lite.js";
import { getDb } from "./firebase.js";
import { requireEnv } from "./utils.js";

const DEBUG_LOG = "/Users/yanivbarkai/finance_app/.cursor/debug-6bce40.log";
const SESSION = "6bce40";

function dbg(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>
) {
  // #region agent log
  const payload = {
    sessionId: SESSION,
    runId: "august-cleanup",
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  try {
    appendFileSync(DEBUG_LOG, JSON.stringify(payload) + "\n");
  } catch {
    /* ignore */
  }
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
  const year = Number(process.env.CLEANUP_YEAR ?? "2026");
  const monthIndex = Number(process.env.CLEANUP_MONTH ?? "8") - 1; // 0-based

  const monthAnchor = new Date(year, monthIndex, 15);
  const rangeStart = startOfMonth(monthAnchor);
  const rangeEnd = endOfMonth(monthAnchor);

  const col = getDb().collection(`users/${uid}/books/${bookId}/transactions`);
  const snap = await col
    .where("date", ">=", Timestamp.fromDate(rangeStart))
    .where("date", "<=", Timestamp.fromDate(rangeEnd))
    .get();

  const toDelete: Array<{ id: string; source: string | null; type: string | null }> = [];
  let expenseCount = 0;
  let maxExpenseCount = 0;
  let otherCount = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const type = (d.type as string | undefined) ?? null;
    const source = (d.source as string | undefined) ?? null;
    if (type !== "expense") {
      otherCount++;
      continue;
    }
    expenseCount++;
    if (source === "max") maxExpenseCount++;
    toDelete.push({ id: doc.id, source, type });
  }

  // #region agent log
  dbg("A", "cleanup-august.ts:plan", "August expense cleanup plan", {
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    docsInMonth: snap.size,
    expenseCount,
    maxExpenseCount,
    nonExpenseSkipped: otherCount,
    deleteCount: toDelete.length,
  });
  // #endregion

  const CHUNK = 400;
  for (let i = 0; i < toDelete.length; i += CHUNK) {
    const batch = getDb().batch();
    for (const row of toDelete.slice(i, i + CHUNK)) {
      batch.delete(col.doc(row.id));
    }
    await batch.commit();
  }

  // Clear August alertState so thresholds can re-fire after re-import
  const alertPrefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}_`;
  const alertSnap = await getDb().collection(`users/${uid}/alertState`).get();
  const alertDeletes: string[] = [];
  for (const doc of alertSnap.docs) {
    if (doc.id.startsWith(alertPrefix)) alertDeletes.push(doc.id);
  }
  for (let i = 0; i < alertDeletes.length; i += CHUNK) {
    const batch = getDb().batch();
    for (const id of alertDeletes.slice(i, i + CHUNK)) {
      batch.delete(getDb().doc(`users/${uid}/alertState/${id}`));
    }
    await batch.commit();
  }

  // Force next sync to backfill from ~90 days (covers all of August)
  await getDb()
    .doc(`users/${uid}`)
    .set(
      {
        maxSync: {
          bookId,
          lastSyncStatus: "error",
          lastSyncError: "reset for August re-import",
          lastSyncAt: FieldValue.delete(),
          lastSyncCount: 0,
        },
      },
      { merge: true }
    );

  // #region agent log
  dbg("B", "cleanup-august.ts:done", "cleanup finished; sync window reset", {
    deletedExpenses: toDelete.length,
    deletedAlertStates: alertDeletes.length,
    maxSyncReset: true,
  });
  // #endregion

  console.log(
    JSON.stringify(
      {
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
        deletedExpenses: toDelete.length,
        maxExpensesDeleted: maxExpenseCount,
        deletedAlertStates: alertDeletes.length,
        maxSyncReset: true,
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
