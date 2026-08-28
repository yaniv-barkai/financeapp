import "./load-env.js";
import { categorizeMerchants } from "./categorize.js";
import {
  getMaxSyncSettings,
  setMaxSyncResult,
  setMaxSyncRunning,
} from "./firebase.js";
import {
  importRows,
  loadCategories,
  loadExistingSourceKeys,
  loadMerchantMemory,
  pickUnknownCategoryId,
} from "./import.js";
import { scrapeMaxTransactions } from "./scrape.js";
import { requireEnv } from "./utils.js";

const OVERLAP_DAYS = 3;

function subtractDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

async function triggerBudgetAlerts(): Promise<void> {
  const baseUrl = process.env.VERCEL_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!baseUrl || !cronSecret) return;

  try {
    await fetch(`${baseUrl.replace(/\/$/, "")}/api/cron/budget-alerts`, {
      method: "GET",
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
  } catch {
    // non-fatal
  }
}

async function main() {
  const uid = requireEnv("SYNC_USER_UID");
  const username = requireEnv("MAX_USERNAME");
  const password = requireEnv("MAX_PASSWORD");
  const openaiKey = process.env.OPENAI_API_KEY;

  const envBookId = process.env.SYNC_BOOK_ID;
  const settings = await getMaxSyncSettings(uid);
  const bookId = envBookId || settings?.bookId;
  if (!bookId) {
    throw new Error("SYNC_BOOK_ID not set and no maxSync.bookId in Firestore");
  }

  await setMaxSyncRunning(uid, bookId);

  try {
    const endDate = new Date();
    // Only shrink the window after a successful sync. Failed runs must not
    // advance lastSyncAt / truncate the backfill range.
    const lastOkSync =
      settings?.lastSyncStatus === "ok" ? settings.lastSyncAt?.toDate() : undefined;
    const startDate = lastOkSync
      ? subtractDays(lastOkSync, OVERLAP_DAYS)
      : subtractDays(endDate, 90);

    const scraped = await scrapeMaxTransactions(username, password, startDate, endDate);
    console.log(`Scraped ${scraped.length} transaction(s) from MAX`);

    // Scraper may return rows slightly before startDate (timezone / calendar-day).
    // Dedup must cover every scraped date or re-sync will re-import them.
    const dedupFrom = scraped.reduce(
      (min, r) => (r.date < min ? r.date : min),
      startDate
    );
    const existingKeys = await loadExistingSourceKeys(uid, bookId, dedupFrom);
    const seenInBatch = new Set<string>();
    const newRows = scraped.filter((r) => {
      if (existingKeys.has(r.sourceKey) || seenInBatch.has(r.sourceKey)) return false;
      seenInBatch.add(r.sourceKey);
      return true;
    });
    console.log(`${newRows.length} new (after dedup)`);

    const categories = await loadCategories(uid, bookId);
    const merchantMemory = await loadMerchantMemory(uid, bookId);
    const unknownCategoryId = pickUnknownCategoryId(categories);
    const expenseCategories = categories.filter((c) => c.type === "expense");

    // Priority: 1) merchant memory (auto)  2) ChatGPT  3) Unknown/Other
    // Only call AI for merchants with no prior setting (or prior = unknown).
    const merchantsForAi = [
      ...new Set(
        newRows
          .filter((r) => {
            const mem = merchantMemory[r.merchantNormalized];
            return !mem || mem === unknownCategoryId;
          })
          .map((r) => r.merchantDisplay)
      ),
    ];

    let aiMatches: Record<string, string> = {};
    if (merchantsForAi.length) {
      if (!openaiKey) {
        throw new Error("OPENAI_API_KEY required to categorize imported transactions");
      }
      aiMatches = await categorizeMerchants(
        merchantsForAi,
        expenseCategories,
        openaiKey
      );
    }

    const toImport = newRows.map((row) => {
      const fromMemory = merchantMemory[row.merchantNormalized];
      const memoryOk = fromMemory && fromMemory !== unknownCategoryId ? fromMemory : undefined;
      const fromAi = aiMatches[row.merchantDisplay];
      const categoryId = memoryOk || fromAi || unknownCategoryId;
      return { ...row, categoryId };
    });

    const count = await importRows(uid, bookId, toImport, {
      skipMemoryCategoryIds: new Set([unknownCategoryId]),
    });
    await setMaxSyncResult(uid, bookId, { status: "ok", count });
    await triggerBudgetAlerts();

    console.log(`MAX sync complete: ${count} new transactions imported`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setMaxSyncResult(uid, bookId, { status: "error", error: message, count: 0 });
    console.error("MAX sync failed:", message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("MAX sync failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
