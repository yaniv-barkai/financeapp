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

export function autoDetectColumns(headers: string[]): {
  dateCol: string | null;
  merchantCol: string | null;
  amountCol: string | null;
  debitCol: string | null;
  creditCol: string | null;
} {
  const lower = headers.map((h) => h.toLowerCase());

  const find = (...candidates: string[]) =>
    headers[lower.findIndex((h) => candidates.some((c) => h.includes(c)))] ??
    null;

  return {
    dateCol: find("date", "תאריך", "transaction date"),
    merchantCol: find(
      "description",
      "merchant",
      "details",
      "name",
      "payee",
      "מוטב",
      "תיאור"
    ),
    amountCol: find("amount", "sum", "total", "סכום", "credit/debit"),
    debitCol: find("debit", "charge", "חיוב"),
    creditCol: find("credit", "deposit", "זכות"),
  };
}

export type DateFormat = "auto" | "DMY" | "MDY" | "YMD";

function parseDateWithFormat(raw: string, format: DateFormat): Date {
  if (format === "auto") {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  // Split on common separators: - / . space
  const parts = raw.split(/[-/.\\s]+/);
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
      const merchantRaw = row[opts.merchantCol] ?? "";
      let amount = 0;
      let type: ImportRow["type"] = "expense";

      if (opts.debitCol && opts.creditCol) {
        const debit = parseFloat(row[opts.debitCol]?.replace(/[^0-9.-]/g, "") ?? "0") || 0;
        const credit = parseFloat(row[opts.creditCol]?.replace(/[^0-9.-]/g, "") ?? "0") || 0;
        if (credit > 0) {
          amount = credit;
          type = "income";
        } else {
          amount = debit;
          type = "expense";
        }
      } else if (opts.amountCol) {
        const raw = parseFloat(row[opts.amountCol]?.replace(/[^0-9.-]/g, "") ?? "0") || 0;
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
