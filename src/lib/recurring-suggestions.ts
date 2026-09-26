import { getMonth, getYear } from "date-fns";
import { Recurring, Transaction } from "./types";
import { getMonthKey, normalizemerchant } from "./utils";

/** Day-of-month window: same day or up to 3 days before/after. */
export const RECURRING_DAY_TOLERANCE = 3;

export interface RecurringSuggestion {
  /** Stable key for dismiss / dedupe: merchant|roundedAmount|anchorDay */
  fingerprint: string;
  type: "expense";
  amount: number;
  categoryId: string;
  merchantDisplay: string;
  merchantNormalized: string;
  /** Typical day of month (median of matching occurrences). */
  dayOfMonth: number;
  /** One representative transaction per matched month (newest first). */
  occurrences: Transaction[];
  monthsMatched: string[];
}

function txMerchantKey(tx: Transaction): string {
  if (tx.merchantNormalized?.trim()) return tx.merchantNormalized.trim();
  if (tx.merchantDisplay?.trim()) return normalizemerchant(tx.merchantDisplay);
  return "";
}

/** Exact amount to the cent — one-offs with similar totals must not cluster. */
function amountBucket(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function sameAmount(a: number, b: number): boolean {
  return amountBucket(a) === amountBucket(b);
}

/** Absolute day-of-month distance. */
export function dayOfMonthDistance(dayA: number, dayB: number): number {
  return Math.abs(dayA - dayB);
}

/**
 * Calendar day-of-month in Asia/Jerusalem — matches how MAX sync stores dates,
 * avoids UTC off-by-one vs local getDate().
 */
export function israelDayOfMonth(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      day: "numeric",
    }).format(date)
  );
}

/** YYYY-MM in Asia/Jerusalem. */
export function israelMonthKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

function monthKeysLookingBack(anchorMonthKey: string, count: number): string[] {
  const [year, month] = anchorMonthKey.split("-").map(Number);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    keys.push(getMonthKey(d));
  }
  return keys;
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function matchesExistingRecurring(
  merchant: string,
  amount: number,
  dayOfMonth: number,
  existing: Recurring[]
): boolean {
  return existing.some((r) => {
    if (r.type !== "expense" || !r.active) return false;
    if (!sameAmount(r.amount, amount)) return false;
    const rMerchant = r.merchantDisplay?.trim()
      ? normalizemerchant(r.merchantDisplay)
      : "";
    const merchantMatch =
      (!merchant && !rMerchant) ||
      (Boolean(merchant) && merchant === rMerchant);
    if (!merchantMatch) return false;
    if (typeof r.dayOfMonth === "number") {
      return dayOfMonthDistance(r.dayOfMonth, dayOfMonth) <= RECURRING_DAY_TOLERANCE;
    }
    return true;
  });
}

export function suggestionFingerprint(
  merchantNormalized: string,
  amount: number,
  dayOfMonth: number
): string {
  return `${merchantNormalized}|${amount.toFixed(2)}|${dayOfMonth}`;
}

interface SeriesCandidate {
  picks: Transaction[];
  monthsMatched: string[];
  dayOfMonth: number;
  score: number;
}

/**
 * For an amount group split by month, find the best day-aligned series
 * among unused transactions. Tries each observed day as an anchor.
 */
export function findBestDaySeries(
  monthKeys: string[],
  byMonth: Map<string, Transaction[]>,
  usedTxIds: Set<string>,
  minMonths: number
): SeriesCandidate | null {
  const anchorDays = new Set<number>();
  for (const mk of monthKeys) {
    for (const t of byMonth.get(mk) ?? []) {
      if (usedTxIds.has(t.id)) continue;
      anchorDays.add(israelDayOfMonth(t.date.toDate()));
    }
  }

  let best: SeriesCandidate | null = null;

  for (const anchorDay of anchorDays) {
    const picks: Transaction[] = [];
    const monthsMatched: string[] = [];
    let score = 0;

    for (const mk of monthKeys) {
      let bestTx: Transaction | null = null;
      let bestDist = Infinity;
      for (const t of byMonth.get(mk) ?? []) {
        if (usedTxIds.has(t.id)) continue;
        const dist = dayOfMonthDistance(
          israelDayOfMonth(t.date.toDate()),
          anchorDay
        );
        if (dist <= RECURRING_DAY_TOLERANCE && dist < bestDist) {
          bestDist = dist;
          bestTx = t;
        }
      }
      if (bestTx) {
        picks.push(bestTx);
        monthsMatched.push(mk);
        score += bestDist;
      }
    }

    if (picks.length < minMonths) continue;

    const dayOfMonth = median(
      picks.map((t) => israelDayOfMonth(t.date.toDate()))
    );

    // Prefer more months matched, then tighter day alignment
    if (
      !best ||
      picks.length > best.picks.length ||
      (picks.length === best.picks.length && score < best.score)
    ) {
      best = { picks, monthsMatched, dayOfMonth, score };
    }
  }

  return best;
}

/**
 * Detect recurring expense patterns in the last `monthsBack` months.
 *
 * A suggestion requires the same merchant, the exact same amount (to the
 * cent), and a day-of-month within ±3 days — across enough months that a
 * one-off purchase cannot qualify.
 *
 * For noisy merchants (e.g. many ITUNES one-offs), groups by exact amount
 * and searches for a day-of-month anchor so only the repeating subset is
 * suggested. Multiple series per merchant are allowed.
 *
 * Default: must appear in all lookback months (3 of 3).
 */
export function detectRecurringSuggestions(
  transactions: Transaction[],
  existingRecurring: Recurring[],
  options: {
    anchorMonthKey: string;
    monthsBack?: number;
    /** Minimum months a series must appear in (default = monthsBack). */
    minMonthsMatched?: number;
    dismissedFingerprints?: Iterable<string>;
  }
): RecurringSuggestion[] {
  const monthsBack = options.monthsBack ?? 3;
  const minMonths = options.minMonthsMatched ?? monthsBack;
  const monthKeys = monthKeysLookingBack(options.anchorMonthKey, monthsBack);
  const monthKeySet = new Set(monthKeys);
  const dismissed = new Set(options.dismissedFingerprints ?? []);

  const expenses = transactions.filter((tx) => {
    if (tx.type !== "expense") return false;
    if (tx.recurringId) return false;
    return monthKeySet.has(israelMonthKey(tx.date.toDate()));
  });

  const byMerchant = new Map<string, Transaction[]>();
  for (const tx of expenses) {
    const merchant = txMerchantKey(tx);
    if (!merchant) continue;
    const list = byMerchant.get(merchant) ?? [];
    list.push(tx);
    byMerchant.set(merchant, list);
  }

  const suggestions: RecurringSuggestion[] = [];
  const seenFingerprints = new Set<string>();

  for (const [merchantNormalized, merchantTxs] of byMerchant) {
    // Exact amount only — similar grocery totals must not merge
    const amountGroups = new Map<number, Transaction[]>();
    for (const tx of merchantTxs) {
      const target = amountBucket(tx.amount);
      const list = amountGroups.get(target) ?? [];
      list.push(tx);
      amountGroups.set(target, list);
    }

    for (const [, amountTxs] of amountGroups) {
      const byMonth = new Map<string, Transaction[]>();
      for (const tx of amountTxs) {
        const mk = israelMonthKey(tx.date.toDate());
        if (!monthKeySet.has(mk)) continue;
        const list = byMonth.get(mk) ?? [];
        list.push(tx);
        byMonth.set(mk, list);
      }

      const monthsPresent = monthKeys.filter((mk) => byMonth.has(mk)).length;
      if (monthsPresent < minMonths) continue;

      const usedTxIds = new Set<string>();

      // Extract every distinct day-aligned series for this amount
      for (;;) {
        const series = findBestDaySeries(
          monthKeys,
          byMonth,
          usedTxIds,
          minMonths
        );
        if (!series) break;

        for (const t of series.picks) usedTxIds.add(t.id);

        const amount =
          series.picks.reduce((s, t) => s + t.amount, 0) / series.picks.length;
        const roundedAmount = amountBucket(amount);

        if (
          matchesExistingRecurring(
            merchantNormalized,
            roundedAmount,
            series.dayOfMonth,
            existingRecurring
          )
        ) {
          continue;
        }

        const fingerprint = suggestionFingerprint(
          merchantNormalized,
          roundedAmount,
          series.dayOfMonth
        );
        if (dismissed.has(fingerprint) || seenFingerprints.has(fingerprint)) {
          continue;
        }
        seenFingerprints.add(fingerprint);

        const latest = series.picks[series.picks.length - 1];
        suggestions.push({
          fingerprint,
          type: "expense",
          amount: roundedAmount,
          categoryId: latest.categoryId,
          merchantDisplay:
            latest.merchantDisplay?.trim() ||
            series.picks.map((p) => p.merchantDisplay).find((m) => m?.trim()) ||
            merchantNormalized,
          merchantNormalized,
          dayOfMonth: series.dayOfMonth,
          occurrences: [...series.picks].reverse(),
          monthsMatched: series.monthsMatched,
        });
      }
    }
  }

  return suggestions.sort((a, b) => {
    // Prefer series seen in more months, then higher amount
    if (b.monthsMatched.length !== a.monthsMatched.length) {
      return b.monthsMatched.length - a.monthsMatched.length;
    }
    return b.amount - a.amount;
  });
}

/** localStorage helpers for dismissed suggestion fingerprints (per book). */
export function dismissedSuggestionsStorageKey(bookId: string): string {
  // v3: exact-amount matcher (invalidate soft-tolerance dismissals)
  return `recurring-suggestions-dismissed:v3:${bookId}`;
}

export function loadDismissedSuggestions(bookId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(dismissedSuggestionsStorageKey(bookId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveDismissedSuggestions(bookId: string, fingerprints: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    dismissedSuggestionsStorageKey(bookId),
    JSON.stringify(fingerprints)
  );
}

/** Clear dismissed suggestion fingerprints for a book. */
export function clearDismissedSuggestions(bookId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(dismissedSuggestionsStorageKey(bookId));
}

/** Build nextRunDate for a newly accepted monthly suggestion. */
export function nextRunFromSuggestion(
  dayOfMonth: number,
  fromDate: Date = new Date()
): Date {
  const y = getYear(fromDate);
  const m = getMonth(fromDate);
  const thisMonthDay = Math.min(
    dayOfMonth,
    new Date(y, m + 1, 0).getDate()
  );
  const candidate = new Date(y, m, thisMonthDay, 12, 0, 0, 0);
  if (candidate > fromDate) return candidate;
  const nextMonthDay = Math.min(
    dayOfMonth,
    new Date(y, m + 2, 0).getDate()
  );
  return new Date(y, m + 1, nextMonthDay, 12, 0, 0, 0);
}
