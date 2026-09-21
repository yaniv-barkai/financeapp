/**
 * Repair Max installment transactions already in Firestore.
 *
 * - Re-scrapes with paymentDate + "תשלום N מתוך M" mapping
 * - Upserts installment rows (create missing, update existing)
 * - Deletes legacy full-charge / wrong-dated rows that the new mapper skips
 *
 * Usage: npx tsx repair-installments.ts
 */
import "./load-env.js";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb, getMaxSyncSettings } from "./firebase.js";
import { pickUnknownCategoryId, loadCategories, loadMerchantMemory } from "./import.js";
import { scrapeMaxTransactions } from "./scrape.js";
import { israelCalendarDay, requireEnv } from "./utils.js";

function subtractDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

async function main() {
  const uid = requireEnv("SYNC_USER_UID");
  const username = requireEnv("MAX_USERNAME");
  const password = requireEnv("MAX_PASSWORD");
  const envBookId = process.env.SYNC_BOOK_ID;
  const settings = await getMaxSyncSettings(uid);
  const bookId = envBookId || settings?.bookId;
  if (!bookId) throw new Error("No book id");

  const endDate = new Date();
  const startDate = subtractDays(endDate, 120);

  console.log("Scraping MAX with installment-aware mapper…");
  const scraped = await scrapeMaxTransactions(username, password, startDate, endDate);
  const installmentRows = scraped.filter((r) => r.installments);
  console.log(
    `Scraped ${scraped.length} rows, ${installmentRows.length} with installments`
  );

  for (const r of installmentRows) {
    console.log(
      `  ${israelCalendarDay(r.date)}  ${r.amount.toFixed(2)}  ${r.installments!.number}/${r.installments!.total}  ${r.merchantDisplay}`
    );
  }

  const db = getDb();
  const col = db.collection(`users/${uid}/books/${bookId}/transactions`);
  const snap = await col.where("source", "==", "max").get();

  const bySourceKey = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();

  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.sourceKey) bySourceKey.set(d.sourceKey as string, doc);
  }

  const categories = await loadCategories(uid, bookId);
  const memory = await loadMerchantMemory(uid, bookId);
  const unknownId = pickUnknownCategoryId(categories);

  let updated = 0;
  let created = 0;
  let deleted = 0;

  // Upsert installment (and other) scraped rows that have installments metadata.
  for (const row of installmentRows) {
    const existing = bySourceKey.get(row.sourceKey);
    const categoryId =
      memory[row.merchantNormalized] && memory[row.merchantNormalized] !== unknownId
        ? memory[row.merchantNormalized]
        : unknownId;

    if (existing) {
      await existing.ref.update({
        amount: row.amount,
        date: Timestamp.fromDate(row.date),
        note: row.note ?? FieldValue.delete(),
        installments: row.installments,
        ...(row.originalAmount != null
          ? { originalAmount: row.originalAmount }
          : { originalAmount: FieldValue.delete() }),
        sourceKey: row.sourceKey,
        merchantDisplay: row.merchantDisplay,
        merchantNormalized: row.merchantNormalized,
      });
      updated++;
      continue;
    }

    // Legacy row: same amount+merchant but wrong date / no installment suffix.
    const legacyCandidates = snap.docs.filter((doc) => {
      const d = doc.data();
      if ((d.merchantNormalized as string) !== row.merchantNormalized) return false;
      if (Number(d.amount) !== row.amount) return false;
      if (d.installments) return false;
      return true;
    });

    if (legacyCandidates.length === 1) {
      await legacyCandidates[0].ref.update({
        amount: row.amount,
        date: Timestamp.fromDate(row.date),
        note: row.note ?? FieldValue.delete(),
        installments: row.installments,
        ...(row.originalAmount != null
          ? { originalAmount: row.originalAmount }
          : { originalAmount: FieldValue.delete() }),
        sourceKey: row.sourceKey,
        merchantDisplay: row.merchantDisplay,
        merchantNormalized: row.merchantNormalized,
      });
      updated++;
      bySourceKey.set(row.sourceKey, legacyCandidates[0]);
      continue;
    }

    await col.add({
      type: "expense",
      amount: row.amount,
      categoryId,
      merchantDisplay: row.merchantDisplay,
      merchantNormalized: row.merchantNormalized,
      date: Timestamp.fromDate(row.date),
      tags: [],
      source: "max",
      sourceKey: row.sourceKey,
      ...(row.note ? { note: row.note } : {}),
      installments: row.installments,
      ...(row.originalAmount != null ? { originalAmount: row.originalAmount } : {}),
      createdAt: Timestamp.now(),
    });
    created++;
  }

  // Delete Max rows for merchants that now have installment coverage, where the
  // row has no installments and matches a full originalAmount that was spread.
  const installmentOriginals = new Map<string, number>();
  for (const row of installmentRows) {
    if (row.originalAmount == null) continue;
    installmentOriginals.set(row.merchantNormalized, row.originalAmount);
  }

  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.installments) continue;
    const merchant = d.merchantNormalized as string | undefined;
    if (!merchant || !installmentOriginals.has(merchant)) continue;
    const original = installmentOriginals.get(merchant)!;
    if (Math.abs(Number(d.amount) - original) > 0.01) continue;
    // Full-charge leftover from before the mapper skipped spread conversions.
    await doc.ref.delete();
    deleted++;
  }

  console.log(
    JSON.stringify(
      { updated, created, deleted, installmentRows: installmentRows.length },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
