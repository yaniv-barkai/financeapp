import { parseCsvAmount, parseDateWithFormat } from "@/lib/csv";
import { ImportRow } from "@/lib/types";
import { normalizemerchant } from "@/lib/utils";
import { ParsedXlsx, XlsxSheet } from "@/lib/import/xlsx";
import { CcExtractor, ExtractorResult } from "./types";

const DATE_HEADER = "תאריך עסקה";
const MERCHANT_HEADER = "שם בית עסק";
const AMOUNT_HEADER = "סכום חיוב";

/** Collapse Excel header newlines / whitespace for matching. */
function normalizeHeader(cell: string): string {
  return cell.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function findHeaderIndex(row: string[], needle: string): number {
  const n = normalizeHeader(needle);
  return row.findIndex((cell) => normalizeHeader(cell) === n);
}

function findHeaderRow(sheet: XlsxSheet): {
  rowIndex: number;
  dateCol: number;
  merchantCol: number;
  amountCol: number;
} | null {
  for (let i = 0; i < Math.min(sheet.rows.length, 20); i++) {
    const row = sheet.rows[i] ?? [];
    const dateCol = findHeaderIndex(row, DATE_HEADER);
    const merchantCol = findHeaderIndex(row, MERCHANT_HEADER);
    const amountCol = findHeaderIndex(row, AMOUNT_HEADER);
    if (dateCol >= 0 && merchantCol >= 0 && amountCol >= 0) {
      return { rowIndex: i, dateCol, merchantCol, amountCol };
    }
  }
  return null;
}

/** Last-4 from title e.g. "לכרטיס ויזה פלטינום המסתיים ב-6233". */
function extractLast4FromText(text: string): string | null {
  const m =
    text.match(/המסתיים\s*ב-?\s*(\d{4})/) ??
    text.match(/כרטיס[^\d]*(\d{4})\b/);
  return m?.[1] ?? null;
}

function findCardLast4(sheet: XlsxSheet): string | null {
  for (let i = 0; i < Math.min(sheet.rows.length, 5); i++) {
    const cell = sheet.rows[i]?.[0] ?? "";
    const last4 = extractLast4FromText(cell);
    if (last4) return last4;
  }
  return extractLast4FromText(sheet.name);
}

function isEndRow(row: string[]): boolean {
  const joined = row.map((c) => c.trim()).filter(Boolean).join(" ");
  if (!joined) return true;
  // Footer / disclaimer rows (CAL / Isracard exports)
  if (joined.includes("את המידע המלא") || joined.includes("סיכום חיובים")) {
    return true;
  }
  return false;
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

  const last4 = findCardLast4(sheet);
  const out: ImportRow[] = [];
  const pendingTagNames: string[] = [];
  let id = startId;

  if (last4) pendingTagNames.push(last4);

  for (let r = header.rowIndex + 1; r < sheet.rows.length; r++) {
    const row = sheet.rows[r] ?? [];
    if (isEndRow(row)) {
      // Trailing blank before footer — keep scanning in case of gaps
      const hasAny = row.some((c) => c.trim());
      if (hasAny) break;
      continue;
    }

    const dateRaw = row[header.dateCol] ?? "";
    const merchantRaw = (row[header.merchantCol] ?? "").trim();
    const amountRaw = row[header.amountCol] ?? "";
    if (!dateRaw || !merchantRaw || !String(amountRaw).trim()) continue;

    const signed = parseCsvAmount(amountRaw);
    if (!Number.isFinite(signed) || signed === 0) continue;

    // Isracard "סכום חיוב": positive = expense, negative = refund/credit
    const amount = Math.abs(signed);
    const type: ImportRow["type"] = signed < 0 ? "income" : "expense";
    const date = parseDateWithFormat(dateRaw, "DMY");
    const normalized = normalizemerchant(merchantRaw);
    const suggestedCategoryId = opts.merchantMemory[normalized] ?? undefined;

    out.push({
      id: `isracard-${id++}`,
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

export function detectIsracardExport(workbook: ParsedXlsx): boolean {
  return workbook.sheets.some((sheet) => findHeaderRow(sheet) != null);
}

export function extractIsracardTransactions(
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
    issuer: "isracard",
    label: "Isracard",
    rows,
    pendingTagNames: [...tagSet],
  };
}

export const isracardExtractor: CcExtractor = {
  id: "isracard",
  label: "Isracard",
  detect: detectIsracardExport,
  extract: extractIsracardTransactions,
};
