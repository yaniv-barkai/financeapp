/**
 * Max API raw-row mapping for installments / payment plans.
 *
 * The upstream scraper drops Max `comments` (e.g. "תשלום 1 מתוך 3") and uses
 * purchaseDate instead of paymentDate, so future installments land on the
 * wrong month. We map from intercepted API rows instead.
 */

export interface MaxInstallments {
  number: number;
  total: number;
}

export interface MaxRawTxn {
  merchantName?: unknown;
  actualPaymentAmount?: unknown;
  originalAmount?: unknown;
  comments?: unknown;
  purchaseDate?: unknown;
  paymentDate?: unknown;
  arn?: unknown;
  [key: string]: unknown;
}

export interface MappedMaxTxn {
  date: Date;
  amount: number;
  merchantDisplay: string;
  note?: string;
  installments?: MaxInstallments;
  originalAmount?: number;
}

const INSTALLMENT_RE = /תשלום\s+(\d+)\s+מתוך\s+(\d+)/;

export function parseInstallmentComment(
  comments: string | null | undefined
): MaxInstallments | null {
  if (!comments) return null;
  const m = comments.match(INSTALLMENT_RE);
  if (!m) return null;
  const number = Number(m[1]);
  const total = Number(m[2]);
  if (!Number.isInteger(number) || !Number.isInteger(total)) return null;
  if (number <= 0 || total <= 0 || number > total) return null;
  return { number, total };
}

function asNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseMaxDate(value: unknown): Date | null {
  const text = asText(value);
  if (!text) return null;
  // Max sends "2026-09-10T00:00:00" without Z — treat as Israel calendar day.
  const day = text.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // Noon UTC → stable Israel day for toIsraelMidnight downstream.
  return new Date(`${day}T12:00:00.000Z`);
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

/**
 * When a charge is converted to installments, Max emits:
 *  - full debit (standing order / charge)
 *  - matching credit (cancel)
 *  - installment rows with comments "תשלום N מתוך M"
 * Keep only the installment rows (and normal non-spread charges).
 */
export function shouldSkipMaxRawTxn(
  row: MaxRawTxn,
  siblings: MaxRawTxn[]
): boolean {
  const amount = asNumber(row.actualPaymentAmount);
  if (amount === null || amount === 0) return true;

  // Credits / installment-conversion cancellations.
  if (amount < 0) return true;

  const comments = asText(row.comments);
  if (parseInstallmentComment(comments)) return false;

  const original = asNumber(row.originalAmount);
  if (original === null || !nearlyEqual(amount, original)) return false;

  const purchase = asText(row.purchaseDate);
  const merchant = asText(row.merchantName);
  const spreadIntoInstallments = siblings.some((s) => {
    if (s === row) return false;
    if (asText(s.merchantName) !== merchant) return false;
    if (asText(s.purchaseDate) !== purchase) return false;
    const sOriginal = asNumber(s.originalAmount);
    if (sOriginal === null || !nearlyEqual(sOriginal, original)) return false;
    return Boolean(parseInstallmentComment(asText(s.comments)));
  });

  return spreadIntoInstallments;
}

export function mapMaxRawTxn(row: MaxRawTxn): MappedMaxTxn | null {
  const amount = asNumber(row.actualPaymentAmount);
  if (amount === null || amount <= 0) return null;

  const merchantDisplay = asText(row.merchantName);
  if (!merchantDisplay) return null;

  const date =
    parseMaxDate(row.paymentDate) ?? parseMaxDate(row.purchaseDate);
  if (!date) return null;

  const comments = asText(row.comments);
  const installments = parseInstallmentComment(comments);
  const original = asNumber(row.originalAmount);

  const mapped: MappedMaxTxn = {
    date,
    amount,
    merchantDisplay,
  };

  if (comments) mapped.note = comments;
  if (installments) mapped.installments = installments;
  if (original !== null && !nearlyEqual(original, amount)) {
    mapped.originalAmount = Math.abs(original);
  }

  return mapped;
}

export function mapMaxRawTransactions(rows: MaxRawTxn[]): MappedMaxTxn[] {
  const out: MappedMaxTxn[] = [];
  for (const row of rows) {
    if (shouldSkipMaxRawTxn(row, rows)) continue;
    const mapped = mapMaxRawTxn(row);
    if (mapped) out.push(mapped);
  }
  return out;
}

export function extractMaxTxnRows(body: unknown): MaxRawTxn[] {
  if (!body || typeof body !== "object") return [];
  const b = body as Record<string, unknown>;
  const result = (b.result ?? b.Result) as Record<string, unknown> | undefined;
  const txns =
    (result?.transactions as unknown[]) ??
    (result?.Transactions as unknown[]) ??
    (b.transactions as unknown[]) ??
    [];
  if (!Array.isArray(txns)) return [];
  return txns.filter((t) => t && typeof t === "object") as MaxRawTxn[];
}
