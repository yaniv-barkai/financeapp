import { ParsedXlsx } from "@/lib/import/xlsx";
import { CcExtractor, ExtractorResult } from "./types";
import { maxExtractor } from "./max";
import { isracardExtractor } from "./isracard";

const EXTRACTORS: CcExtractor[] = [maxExtractor, isracardExtractor];

export function detectCcExtractor(workbook: ParsedXlsx): CcExtractor | null {
  return EXTRACTORS.find((e) => e.detect(workbook)) ?? null;
}

export function extractCcWorkbook(
  workbook: ParsedXlsx,
  opts: {
    merchantMemory: Record<string, string>;
    defaultCategoryId: string;
    defaultBookId: string;
  }
): ExtractorResult | null {
  const extractor = detectCcExtractor(workbook);
  if (!extractor) return null;
  return extractor.extract(workbook, opts);
}

export type { CcExtractor, ExtractorResult, CcIssuer } from "./types";
