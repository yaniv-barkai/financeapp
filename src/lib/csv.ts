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
  }
): ImportRow[] {
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

      const parsedDate = new Date(dateRaw);
      const date = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
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
        skip: false,
        isDuplicate: false,
      } as ImportRow;
    })
    .filter((r) => r.amount > 0);
}
