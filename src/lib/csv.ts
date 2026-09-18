import Papa from "papaparse";
import { normalizemerchant } from "./utils";
import { ImportRow } from "./types";

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsvText(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return {
    headers: result.meta.fields ?? [],
    rows: result.data,
  };
}

function headerScore(header: string, rules: Array<{ re: RegExp; score: number }>): number {
  const h = header.trim().toLowerCase();
  let score = 0;
  for (const { re, score: s } of rules) {
    if (re.test(h)) score += s;
  }
  return score;
}

function pickBestHeader(headers: string[], rules: Array<{ re: RegExp; score: number }>): string | null {
  let best: string | null = null;
  let bestScore = 0;
  for (const header of headers) {
    const score = headerScore(header, rules);
    if (score > bestScore) {
      bestScore = score;
      best = header;
    }
  }
  return bestScore > 0 ? best : null;
}

/** Prefer charged / local-currency amounts; avoid original / foreign (often USD). */
const AMOUNT_RULES: Array<{ re: RegExp; score: number }> = [
  { re: /סכום\s*חיוב|סכום\s*בש"?ח|סכום\s*ב₪|charged|billing\s*amount|amount\s*\(?ils\)?|amount\s*\(?₪\)?/, score: 100 },
  { re: /חיוב|charged|billing|ils|ש"?ח|₪/, score: 40 },
  { re: /^(amount|sum|total|סכום)$/, score: 30 },
  { re: /\b(amount|sum|total)\b|סכום|credit\/debit/, score: 10 },
  // Strongly penalize original / foreign currency columns (common bank CSV trap)
  { re: /מקורי|original|foreign|usd|\$|דולר/, score: -80 },
];

const MERCHANT_RULES: Array<{ re: RegExp; score: number }> = [
  { re: /בית\s*עסק|שם\s*בית|תיאור|מוטב|description|merchant|payee|details/, score: 50 },
  { re: /\b(name|memo)\b|עסק|ספק/, score: 20 },
  { re: /תאריך|date|amount|סכום|sum|total|currency|מטבע|debit|credit|חיוב|זכות/, score: -40 },
];

const DATE_RULES: Array<{ re: RegExp; score: number }> = [
  { re: /תאריך\s*עסקה|transaction\s*date|purchase\s*date/, score: 60 },
  { re: /תאריך|date/, score: 30 },
  { re: /amount|סכום|merchant|תיאור/, score: -40 },
];

const DEBIT_RULES: Array<{ re: RegExp; score: number }> = [
  { re: /\bdebit\b|charge(?!d\s*amount)|חיוב/, score: 40 },
  { re: /סכום\s*מקורי|original|מטבע/, score: -40 },
];

const CREDIT_RULES: Array<{ re: RegExp; score: number }> = [
  { re: /\bcredit\b|deposit|זכות|זיכוי/, score: 40 },
  { re: /credit\/debit|כרטיס\s*אשראי/, score: -40 },
];

export function autoDetectColumns(headers: string[]): {
  dateCol: string | null;
  merchantCol: string | null;
  amountCol: string | null;
  debitCol: string | null;
  creditCol: string | null;
} {
  return {
    dateCol: pickBestHeader(headers, DATE_RULES),
    merchantCol: pickBestHeader(headers, MERCHANT_RULES),
    amountCol: pickBestHeader(headers, AMOUNT_RULES),
    debitCol: pickBestHeader(headers, DEBIT_RULES),
    creditCol: pickBestHeader(headers, CREDIT_RULES),
  };
}

/** True when the amount column is a charged/billing column (expenses usually positive). */
export function isChargedAmountColumn(header: string | null | undefined): boolean {
  if (!header) return false;
  return /סכום\s*חיוב|סכום\s*בש"?ח|charged|billing|חיוב|ils|ש"?ח|₪/i.test(header);
}

export type DateFormat = "auto" | "DMY" | "MDY" | "YMD";

function parseDateWithFormat(raw: string, format: DateFormat): Date {
  if (format === "auto") {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  // Split on common separators: - / . space
  const parts = raw.split(/[-/.\s]+/);
  if (parts.length !== 3) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  let day: number, month: number, year: number;
  if (format === "DMY") {
    [day, month, year] = parts.map(Number);
  } else if (format === "MDY") {
    [month, day, year] = parts.map(Number);
  } else {
    // YMD
    [year, month, day] = parts.map(Number);
  }
  // Handle 2-digit years
  if (year < 100) year += year < 50 ? 2000 : 1900;
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? new Date() : d;
}

/** Parse amounts from bank CSVs (US `1,234.56`, EU/IL `1.234,56` / `1234,56`, currency symbols). */
export function parseCsvAmount(raw: string | undefined | null): number {
  if (!raw) return 0;
  let s = String(raw).trim();
  if (!s) return 0;

  // Accounting negatives: (123.45)
  const parenNeg = /^\(.*\)$/.test(s);
  s = s.replace(/^\((.*)\)$/, "$1");

  // Keep digits, separators, and minus; drop currency letters/symbols
  s = s.replace(/[^\d.,\-]/g, "").replace(/(?!^)-/g, "");

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    // Both present: the last separator is the decimal
    if (lastComma > lastDot) {
      // 1.234,56
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,234.56
      s = s.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    const frac = s.length - lastComma - 1;
    // 123,45 → decimal; 1,234 → thousands (ambiguous if exactly 3 digits — treat as thousands)
    if (frac === 3 && s.indexOf(",") === lastComma) {
      s = s.replace(/,/g, "");
    } else {
      s = s.replace(",", ".");
    }
  }

  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return parenNeg ? -Math.abs(n) : n;
}

export function buildImportRows(
  rows: Record<string, string>[],
  opts: {
    dateCol: string;
    merchantCol: string;
    amountCol?: string;
    debitCol?: string;
    creditCol?: string;
    negativeIsExpense: boolean;
    merchantMemory: Record<string, string>;
    defaultCategoryId: string;
    defaultBookId: string;
    dateFormat?: DateFormat;
  }
): ImportRow[] {
  const dateFormat: DateFormat = opts.dateFormat ?? "auto";
  return rows
    .map((row, i) => {
      const dateRaw = row[opts.dateCol] ?? "";
      const merchantRaw = (row[opts.merchantCol] ?? "").trim();
      let amount = 0;
      let type: ImportRow["type"] = "expense";

      if (opts.debitCol && opts.creditCol) {
        const debit = parseCsvAmount(row[opts.debitCol]);
        const credit = parseCsvAmount(row[opts.creditCol]);
        if (credit > 0) {
          amount = credit;
          type = "income";
        } else {
          amount = Math.abs(debit);
          type = "expense";
        }
      } else if (opts.amountCol) {
        const raw = parseCsvAmount(row[opts.amountCol]);
        if (opts.negativeIsExpense) {
          amount = Math.abs(raw);
          type = raw < 0 ? "expense" : "income";
        } else {
          amount = Math.abs(raw);
          type = raw >= 0 ? "expense" : "income";
        }
      }

      const date = parseDateWithFormat(dateRaw, dateFormat);
      const normalized = normalizemerchant(merchantRaw);
      const suggestedCategoryId = opts.merchantMemory[normalized] ?? undefined;

      return {
        id: `row-${i}`,
        date,
        merchantDisplay: merchantRaw,
        merchantNormalized: normalized,
        amount,
        type,
        categoryId: suggestedCategoryId ?? opts.defaultCategoryId,
        suggestedCategoryId,
        bookId: opts.defaultBookId,
        skip: false,
        isDuplicate: false,
        tags: [],
      } as ImportRow;
    })
    .filter((r) => r.amount > 0);
}
