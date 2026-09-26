import { ImportRow } from "@/lib/types";
import { ParsedXlsx } from "@/lib/import/xlsx";

export type CcIssuer = "max" | "isracard";

export interface ExtractorResult {
  issuer: CcIssuer;
  label: string;
  rows: ImportRow[];
  /** Unique card last-4 (or other) tag names to create/resolve. */
  pendingTagNames: string[];
}

export interface CcExtractor {
  id: CcIssuer;
  label: string;
  detect: (workbook: ParsedXlsx) => boolean;
  extract: (
    workbook: ParsedXlsx,
    opts: {
      merchantMemory: Record<string, string>;
      defaultCategoryId: string;
      defaultBookId: string;
    }
  ) => ExtractorResult;
}
