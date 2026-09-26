import { parseCsvAmount, parseDateWithFormat } from "@/lib/csv";
import { ImportRow } from "@/lib/types";
import { normalizemerchant } from "@/lib/utils";
import { ParsedXlsx, XlsxSheet } from "@/lib/import/xlsx";
import { CcExtractor, ExtractorResult } from "./types";

const DATE_HEADER = "תאריך עסקה";
const MERCHANT_HEADER = "שם בית העסק";
const AMOUNT_HEADER = "סכום חיוב";
const LAST4_HEADER = "4 ספרות אחרונות של כרטיס האשראי";

function findHeaderIndex(row: string[], needle: string): number {
  const n = needle.trim().toLowerCase();
  return row.findIndex((cell) => cell.trim().toLowerCase() === n);
}

function findHeaderRow(sheet: XlsxSheet): {
  rowIndex: number;
  dateCol: number;
  merchantCol: number;
  amountCol: number;
  last4Col: number;
} | null {
  for (let i = 0; i < Math.min(sheet.rows.length, 20); i++) {
    const row = sheet.rows[i] ?? [];
    const dateCol = findHeaderIndex(row, DATE_HEADER);
    const merchantCol = findHeaderIndex(row, MERCHANT_HEADER);
    const amountCol = findHeaderIndex(row, AMOUNT_HEADER);
    const last4Col = findHeaderIndex(row, LAST4_HEADER);
    if (dateCol >= 0 && merchantCol >= 0 && amountCol >= 0) {
      return { rowIndex: i, dateCol, merchantCol, amountCol, last4Col };
    }
  }
  return null;
}

function isTotalRow(row: string[]): boolean {
  const first = (row[0] ?? "").trim();
  return first === "סך הכל" || first.startsWith("סך הכל");
}

function normalizeLast4(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

function extractSheet(
  sheet: XlsxSheet,
  opts: {
    merchantMemory: Record<string, string>;
    defaultCategoryId: string;
    defaultBookId: string;
  },
  startId: number
): { rows: ImportRow[]; pendingTagNames: string[]; nextId: number } {
  const header = findHeaderRow(sheet);
  if (!header) return { rows: [], pendingTagNames: [], nextId: startId };

  const out: ImportRow[] = [];
  const pendingTagNames: string[] = [];
  let id = startId;

  for (let r = header.rowIndex + 1; r < sheet.rows.length; r++) {
    const row = sheet.rows[r] ?? [];
    if (isTotalRow(row)) break;

    const dateRaw = row[header.dateCol] ?? "";
    const merchantRaw = (row[header.merchantCol] ?? "").trim();
    const amountRaw = row[header.amountCol] ?? "";
    if (!dateRaw || !merchantRaw || !String(amountRaw).trim()) continue;

    const signed = parseCsvAmount(amountRaw);
    if (!Number.isFinite(signed) || signed === 0) continue;

    // MAX "סכום חיוב": positive = expense, negative = refund/credit
    const amount = Math.abs(signed);
    const type: ImportRow["type"] = signed < 0 ? "income" : "expense";
    const date = parseDateWithFormat(dateRaw, "DMY");
    const normalized = normalizemerchant(merchantRaw);
    const suggestedCategoryId = opts.merchantMemory[normalized] ?? undefined;

    const last4 =
      header.last4Col >= 0 ? normalizeLast4(row[header.last4Col] ?? "") : null;
    if (last4) pendingTagNames.push(last4);

    out.push({
      id: `max-${id++}`,
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
      pendingTagNames: last4 ? [last4] : undefined,
    });
  }

  return { rows: out, pendingTagNames, nextId: id };
}

export function detectMaxExport(workbook: ParsedXlsx): boolean {
  return workbook.sheets.some((sheet) => findHeaderRow(sheet) != null);
}

export function extractMaxTransactions(
  workbook: ParsedXlsx,
  opts: {
    merchantMemory: Record<string, string>;
    defaultCategoryId: string;
    defaultBookId: string;
  }
): ExtractorResult {
  const rows: ImportRow[] = [];
  const tagSet = new Set<string>();
  let nextId = 0;

  for (const sheet of workbook.sheets) {
    const part = extractSheet(sheet, opts, nextId);
    rows.push(...part.rows);
    for (const t of part.pendingTagNames) tagSet.add(t);
    nextId = part.nextId;
  }

  return {
    issuer: "max",
    label: "MAX",
    rows,
    pendingTagNames: [...tagSet],
  };
}

export const maxExtractor: CcExtractor = {
  id: "max",
  label: "MAX",
  detect: detectMaxExport,
  extract: extractMaxTransactions,
};
