/**
 * Move Max purchases already in Firestore from their billing date to their
 * purchase date (installment payments keep their billing date).
 *
 * - Re-scrapes Max and matches each purchase to the doc stored under its
 *   billing-date key, then updates date + sourceKey (category, tags, notes kept).
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

function subtractDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
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

  const col = getDb().collection(`users/${uid}/books/${bookId}/transactions`);
  const snap = await col.where("source", "==", "max").get();

  const byKey = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.sourceKey) byKey.set(d.sourceKey as string, doc);
    // Legacy docs may hold a UTC-day key; index the Israel-day rebuild too.
    const date = d.date?.toDate?.() as Date | undefined;
    if (date && d.amount != null && d.merchantNormalized) {
      const rebuilt = buildSourceKey(
        date,
        Number(d.amount),
        d.merchantNormalized as string,
        d.installments as { number: number; total: number } | undefined
      );
      if (!byKey.has(rebuilt)) byKey.set(rebuilt, doc);
    }
  }

  let moved = 0;
  let alreadyOk = 0;
  let notFound = 0;
  const duplicates: string[] = [];
  const movedOutOf: Record<string, number> = {};

  for (const row of candidates) {
    const current = byKey.get(row.sourceKey);
    const legacy = byKey.get(row.legacySourceKey!);

    if (current) {
      alreadyOk++;
      if (legacy && legacy.id !== current.id) {
        duplicates.push(`${israelCalendarDay(row.date)} ${row.amount.toFixed(2)} ${row.merchantDisplay} (docs ${current.id}, ${legacy.id})`);
      }
      continue;
    }
    if (!legacy) {
      notFound++;
      continue;
    }

    const from = israelCalendarDay(legacy.data().date.toDate());
    const to = israelCalendarDay(row.date);
    console.log(`  ${from} → ${to}  ${row.amount.toFixed(2)}  ${row.merchantDisplay}`);
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
    byKey.set(row.sourceKey, legacy);
    moved++;
  }

  if (duplicates.length) {
    console.log("\nPossible duplicates (both dates exist) — review manually:");
    for (const line of duplicates) console.log(`  ${line}`);
  }

  const roundedMovedOut = Object.fromEntries(
    Object.entries(movedOutOf).map(([m, v]) => [m, Math.round(v * 100) / 100])
  );
  console.log(
    JSON.stringify(
      { apply, moved, alreadyOk, notFound, duplicates: duplicates.length, movedOutOfMonth: roundedMovedOut },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
