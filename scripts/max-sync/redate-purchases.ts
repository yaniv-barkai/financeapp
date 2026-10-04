/**
 * Move Max purchases already in Firestore from their billing date to their
 * purchase date (installment payments keep their billing date), and delete
 * billing-date copies of purchases that already exist under their purchase date.
 *
 * - Re-scrapes Max and matches each purchase to the doc stored under its
 *   billing-date key, then updates date + sourceKey (category, tags, notes kept).
 * - If the purchase-date doc already exists, the billing-date doc is a duplicate
 *   and is deleted (the purchase-date doc is kept as is).
 * - Docs that are real purchases made on the billing day (Max reports a purchase
 *   under that exact key) are never moved or deleted.
 * - Dry run by default; pass --apply to write.
 *
 * Usage: npx tsx redate-purchases.ts [--apply]
 * Env: REDATE_DAYS (default 120) — how far back to scrape.
 */
import "./load-env.js";
import { Timestamp } from "firebase-admin/firestore";
import { getDb, getMaxSyncSettings } from "./firebase.js";
import { scrapeMaxTransactions } from "./scrape.js";
import { buildSourceKey, israelCalendarDay, requireEnv } from "./utils.js";

type Doc = FirebaseFirestore.QueryDocumentSnapshot;

function subtractDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function createdAtMs(doc: Doc): number {
  return doc.data().createdAt?.toMillis?.() ?? 0;
}

function docKeys(doc: Doc): Set<string> {
  const d = doc.data();
  const keys = new Set<string>();
  if (d.sourceKey) keys.add(d.sourceKey as string);
  // Legacy docs may hold a UTC-day key; index the Israel-day rebuild too.
  const date = d.date?.toDate?.() as Date | undefined;
  if (date && d.amount != null && d.merchantNormalized) {
    keys.add(
      buildSourceKey(
        date,
        Number(d.amount),
        d.merchantNormalized as string,
        d.installments as { number: number; total: number } | undefined
      )
    );
  }
  return keys;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const uid = requireEnv("SYNC_USER_UID");
  const username = requireEnv("MAX_USERNAME");
  const password = requireEnv("MAX_PASSWORD");
  const settings = await getMaxSyncSettings(uid);
  const bookId = process.env.SYNC_BOOK_ID || settings?.bookId;
  if (!bookId) throw new Error("No book id");

  const endDate = new Date();
  const startDate = subtractDays(endDate, Number(process.env.REDATE_DAYS ?? "120"));

  console.log(apply ? "APPLY mode — Firestore will be updated" : "Dry run — pass --apply to write");
  const scraped = await scrapeMaxTransactions(username, password, startDate, endDate);
  const candidates = scraped.filter((r) => r.legacySourceKey);
  console.log(`Scraped ${scraped.length} rows, ${candidates.length} billed on a different day than purchased`);

  // Docs sitting under a key that Max reports as a real purchase on that day.
  const realPurchasesByKey = new Map<string, number>();
  for (const row of scraped) {
    realPurchasesByKey.set(row.sourceKey, (realPurchasesByKey.get(row.sourceKey) ?? 0) + 1);
  }

  const col = getDb().collection(`users/${uid}/books/${bookId}/transactions`);
  const snap = await col.where("source", "==", "max").get();

  const byKey = new Map<string, Doc[]>();
  for (const doc of snap.docs) {
    for (const key of docKeys(doc)) {
      const list = byKey.get(key) ?? [];
      list.push(doc);
      byKey.set(key, list);
    }
  }

  const consumed = new Set<string>();
  const available = (key: string) =>
    (byKey.get(key) ?? []).filter((d) => !consumed.has(d.id));

  // A billing-date key can also be a real purchase made on the billing day;
  // reserve one doc per such purchase so it is never moved or deleted.
  for (const [key, count] of realPurchasesByKey) {
    const docs = available(key).sort((a, b) => createdAtMs(a) - createdAtMs(b));
    for (const doc of docs.slice(0, count)) consumed.add(doc.id);
  }

  let moved = 0;
  let deleted = 0;
  let alreadyOk = 0;
  const movedOutOf: Record<string, number> = {};
  const removedFrom: Record<string, number> = {};
  const moveLines: string[] = [];
  const deleteLines: string[] = [];

  for (const row of candidates) {
    // Newest first: billing-date copies came from the most recent syncs.
    const legacy = available(row.legacySourceKey!).sort(
      (a, b) => createdAtMs(b) - createdAtMs(a)
    )[0];
    if (!legacy) {
      alreadyOk++;
      continue;
    }
    consumed.add(legacy.id);

    const from = israelCalendarDay(legacy.data().date.toDate());
    const to = israelCalendarDay(row.date);
    const hasPurchaseDateDoc = (byKey.get(row.sourceKey) ?? []).some((d) => d.id !== legacy.id);

    if (hasPurchaseDateDoc) {
      deleteLines.push(`  ${from} (dup of ${to})  ${row.amount.toFixed(2)}  ${row.merchantDisplay}`);
      const month = from.slice(0, 7);
      removedFrom[month] = (removedFrom[month] ?? 0) + row.amount;
      if (apply) await legacy.ref.delete();
      deleted++;
      continue;
    }

    moveLines.push(`  ${from} → ${to}  ${row.amount.toFixed(2)}  ${row.merchantDisplay}`);
    const fromMonth = from.slice(0, 7);
    if (fromMonth !== to.slice(0, 7)) {
      movedOutOf[fromMonth] = (movedOutOf[fromMonth] ?? 0) + row.amount;
    }
    if (apply) {
      await legacy.ref.update({
        date: Timestamp.fromDate(row.date),
        sourceKey: row.sourceKey,
      });
    }
    const list = byKey.get(row.sourceKey) ?? [];
    list.push(legacy);
    byKey.set(row.sourceKey, list);
    moved++;
  }

  if (deleteLines.length) {
    console.log(`\nDelete — billing-date copies of purchases already stored (${deleteLines.length}):`);
    for (const line of deleteLines) console.log(line);
  }
  if (moveLines.length) {
    console.log(`\nMove — billing date → purchase date (${moveLines.length}):`);
    for (const line of moveLines) console.log(line);
  }

  const round = (m: Record<string, number>) =>
    Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Math.round(v * 100) / 100]));
  console.log(
    JSON.stringify(
      {
        apply,
        deleted,
        moved,
        alreadyOk,
        removedFromMonth: round(removedFrom),
        movedOutOfMonth: round(movedOutOf),
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
