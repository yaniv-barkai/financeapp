import "./load-env.js";
import { appendFileSync } from "node:fs";
import { getDb, getMaxSyncSettings } from "./firebase.js";
import { requireEnv } from "./utils.js";

const LOG = "/Users/yanivbarkai/finance_app/.cursor/debug-18ad6c.log";
const SESSION = "18ad6c";

function dbg(hypothesisId: string, message: string, data: Record<string, unknown>) {
  // #region agent log
  const payload = {
    sessionId: SESSION,
    runId: "dupes-lastday",
    hypothesisId,
    location: "debug-dupes-lastday.ts",
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
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": SESSION },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // #endregion
}

function israelDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function main() {
  const uid = requireEnv("SYNC_USER_UID");
  const bookId = requireEnv("SYNC_BOOK_ID");
  const settings = await getMaxSyncSettings(uid);

  dbg("E", "maxSync settings", {
    status: settings?.lastSyncStatus ?? null,
    count: settings?.lastSyncCount ?? null,
    at: settings?.lastSyncAt?.toDate?.()?.toISOString?.() ?? null,
    error: settings?.lastSyncError ? String(settings.lastSyncError).slice(0, 200) : null,
  });

  const snap = await getDb()
    .collection(`users/${uid}/books/${bookId}/transactions`)
    .where("source", "==", "max")
    .get();

  const byKey = new Map<string, number>();
  type SoftDoc = {
    id: string;
    sourceKey: string | null;
    utcDay: string;
    israelDay: string;
    dateIso: string;
    createdAt: string | null;
    amount: number;
    merchant: string;
  };
  const soft = new Map<string, SoftDoc[]>();
  const recent: SoftDoc[] = [];
  let keyDayMismatch = 0;
  const mismatchSamples: Array<Record<string, string>> = [];

  for (const doc of snap.docs) {
    const d = doc.data();
    const key = (d.sourceKey as string | undefined) ?? null;
    const date = d.date?.toDate?.() as Date | undefined;
    const createdAt = d.createdAt?.toDate?.() as Date | undefined;
    const amount = d.amount as number;
    const merchant = String(d.merchantNormalized ?? d.merchantDisplay ?? "");
    if (key) byKey.set(key, (byKey.get(key) ?? 0) + 1);
    if (!date) continue;

    const iDay = israelDay(date);
    const utcDay = date.toISOString().slice(0, 10);
    const softKey = `${iDay}|${Number(amount).toFixed(2)}|${merchant}`;
    const row: SoftDoc = {
      id: doc.id,
      sourceKey: key,
      utcDay,
      israelDay: iDay,
      dateIso: date.toISOString(),
      createdAt: createdAt?.toISOString() ?? null,
      amount,
      merchant: String(d.merchantDisplay ?? "").slice(0, 40),
    };
    const list = soft.get(softKey) ?? [];
    list.push(row);
    soft.set(softKey, list);
    recent.push(row);

    if (key) {
      const keyDay = key.split(":")[1] ?? "";
      if (keyDay !== iDay) {
        keyDayMismatch++;
        if (mismatchSamples.length < 6) {
          mismatchSamples.push({
            sourceKey: key,
            israelDay: iDay,
            utcDay,
            dateIso: date.toISOString(),
          });
        }
      }
    }
  }

  const exactDupes = [...byKey.entries()].filter(([, n]) => n > 1);
  const softDupes = [...soft.entries()].filter(([, arr]) => arr.length > 1);
  const softDiffKeys = softDupes.filter(
    ([, arr]) => new Set(arr.map((x) => x.sourceKey)).size > 1
  );
  const softSameKey = softDupes.filter(
    ([, arr]) => new Set(arr.map((x) => x.sourceKey)).size === 1
  );

  recent.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const latestCreated = recent[0]?.createdAt;
  const latestMinute = latestCreated?.slice(0, 16) ?? "";
  const latestBatch = recent.filter((r) => (r.createdAt ?? "").startsWith(latestMinute));
  const byDay: Record<string, number> = {};
  for (const r of latestBatch) {
    byDay[r.israelDay] = (byDay[r.israelDay] ?? 0) + 1;
  }

  // Also: find days that appear twice in createdAt clusters (re-imported last day)
  const createdBuckets = new Map<string, SoftDoc[]>();
  for (const r of recent) {
    if (!r.createdAt) continue;
    const bucket = r.createdAt.slice(0, 16); // minute
    const list = createdBuckets.get(bucket) ?? [];
    list.push(r);
    createdBuckets.set(bucket, list);
  }
  const importBatches = [...createdBuckets.entries()]
    .filter(([, arr]) => arr.length >= 3)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 5)
    .map(([minute, arr]) => {
      const days: Record<string, number> = {};
      for (const r of arr) days[r.israelDay] = (days[r.israelDay] ?? 0) + 1;
      return { minute, count: arr.length, byIsraelDay: days };
    });

  dbg("A", "exact sourceKey duplicates", {
    totalMaxTx: snap.size,
    uniqueSourceKeys: byKey.size,
    exactDuplicateKeyCount: exactDupes.length,
    exactDupes: exactDupes.slice(0, 10).map(([k, n]) => ({ key: k, count: n })),
  });

  dbg("B", "soft duplicates same Israel-day/amount/merchant", {
    softDuplicateGroups: softDupes.length,
    softDiffKeyGroups: softDiffKeys.length,
    softSameKeyGroups: softSameKey.length,
    softDiffExamples: softDiffKeys.slice(0, 8).map(([k, arr]) => ({
      softKey: k,
      docs: arr,
    })),
    softSameKeyExamples: softSameKey.slice(0, 5).map(([k, arr]) => ({
      softKey: k,
      count: arr.length,
      sourceKey: arr[0]?.sourceKey,
    })),
  });

  dbg("C", "sourceKey UTC day vs Israel day mismatch", {
    keyDayMismatch,
    mismatchSamples,
  });

  dbg("D", "latest import batches", {
    latestImport: {
      createdAt: latestCreated,
      count: latestBatch.length,
      byIsraelDay: byDay,
      sample: latestBatch.slice(0, 10),
    },
    importBatches,
  });

  console.log(
    JSON.stringify(
      {
        settings: {
          status: settings?.lastSyncStatus,
          count: settings?.lastSyncCount,
          at: settings?.lastSyncAt?.toDate?.()?.toISOString?.(),
        },
        totalMaxTx: snap.size,
        exactDuplicateKeyCount: exactDupes.length,
        softDiffKeyGroups: softDiffKeys.length,
        softSameKeyGroups: softSameKey.length,
        keyDayMismatch,
        mismatchSamples,
        softDiffExamples: softDiffKeys.slice(0, 5).map(([k, arr]) => ({
          softKey: k,
          keys: [...new Set(arr.map((x) => x.sourceKey))],
          dates: arr.map((x) => x.dateIso),
          createdAts: arr.map((x) => x.createdAt),
        })),
        importBatches,
        latestByIsraelDay: byDay,
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
