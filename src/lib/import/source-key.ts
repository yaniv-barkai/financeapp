import { Timestamp } from "firebase/firestore";
import { ImportRow, Transaction } from "@/lib/types";

/** Calendar day in Israel — matches MAX sync / IL bank exports. */
export function israelCalendarDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Stable tag fingerprint: sorted unique ids (empty → ""). */
export function tagsFingerprint(tags: string[] | undefined | null): string {
  if (!tags?.length) return "";
  return [...new Set(tags.filter(Boolean))].sort().join(",");
}

/**
 * Soft fingerprint for exact duplicate matching.
 * Identity = Israel calendar day + amount + merchant + tags (when any).
 * Same shape as max-sync `sourceKey` suffix when tags are empty.
 */
export function buildSoftSourceKey(
  date: Date,
  amount: number,
  merchantNormalized: string,
  tags?: string[] | null,
  installments?: { number: number; total: number } | null
): string {
  const day = israelCalendarDay(date);
  let key = `${day}:${amount.toFixed(2)}:${merchantNormalized}`;
  const tagFp = tagsFingerprint(tags);
  if (tagFp) key += `:tags:${tagFp}`;
  if (installments) key += `:${installments.number}/${installments.total}`;
  return key;
}

/** Stored on Transaction.sourceKey — prefix keeps origin clear. */
export function buildImportSourceKey(
  source: "csv" | "max",
  date: Date,
  amount: number,
  merchantNormalized: string,
  tags?: string[] | null,
  installments?: { number: number; total: number } | null
): string {
  return `${source}:${buildSoftSourceKey(date, amount, merchantNormalized, tags, installments)}`;
}

/** Strip known prefixes so csv/max keys compare equal for soft matching. */
export function softKeyFromStored(sourceKey: string): string {
  return sourceKey.replace(/^(max|csv|isracard):/, "");
}

export function softKeyFromTransaction(tx: {
  date: Date | Timestamp;
  amount: number;
  merchantNormalized?: string;
  tags?: string[];
  installments?: { number: number; total: number };
  sourceKey?: string;
}): string | null {
  const date =
    tx.date instanceof Timestamp
      ? tx.date.toDate()
      : tx.date instanceof Date
        ? tx.date
        : null;
  if (!date || tx.amount == null) return null;

  const merchant = (tx.merchantNormalized ?? "").trim();
  if (merchant) {
    return buildSoftSourceKey(
      date,
      tx.amount,
      merchant,
      tx.tags,
      tx.installments
    );
  }
  if (tx.sourceKey) return softKeyFromStored(tx.sourceKey);
  return null;
}

/** Count how many times each soft key already exists in the book. */
export function countExistingSoftKeys(txs: Transaction[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tx of txs) {
    const soft = softKeyFromTransaction(tx);
    if (!soft) continue;
    counts.set(soft, (counts.get(soft) ?? 0) + 1);
  }
  return counts;
}

/**
 * Mark rows that already exist in `existingCounts` (exact day+amount+merchant+tags).
 * Occurrence-based: if DB has N matches and the file has M, min(N,M) are
 * duplicates and the rest stay new.
 */
export function markDuplicateRows(
  rows: ImportRow[],
  existingCounts: Map<string, number>,
  source: "csv" | "max" = "csv"
): ImportRow[] {
  const remaining = new Map(existingCounts);
  return rows.map((row) => {
    const soft = buildSoftSourceKey(
      row.date,
      row.amount,
      row.merchantNormalized,
      row.tags
    );
    const sourceKey = buildImportSourceKey(
      source,
      row.date,
      row.amount,
      row.merchantNormalized,
      row.tags
    );
    const n = remaining.get(soft) ?? 0;
    if (n > 0) {
      remaining.set(soft, n - 1);
      return { ...row, sourceKey, isDuplicate: true, skip: true };
    }
    return { ...row, sourceKey, isDuplicate: false };
  });
}

/** Inclusive padded range for loading existing txs (timezone buffer). */
export function importDateRange(rows: ImportRow[]): { start: Date; end: Date } | null {
  if (rows.length === 0) return null;
  let min = rows[0].date.getTime();
  let max = min;
  for (const r of rows) {
    const t = r.date.getTime();
    if (t < min) min = t;
    if (t > max) max = t;
  }
  const dayMs = 24 * 60 * 60 * 1000;
  return {
    start: new Date(min - dayMs),
    end: new Date(max + dayMs),
  };
}
