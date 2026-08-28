import { createScraper, CompanyTypes } from "@sergienko4/israeli-bank-scrapers";
import type { ScrapedRow } from "./import.js";
import { buildSourceKey, keepEventLoopAlive, normalizeMerchant } from "./utils.js";

interface ScraperTransaction {
  description?: string;
  memo?: string;
  chargedAmount?: number;
  originalAmount?: number;
  date?: string | Date;
  processedDate?: string | Date;
}

function parseScraperDate(value: string | Date | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseAmount(tx: ScraperTransaction): number | null {
  const raw = tx.chargedAmount ?? tx.originalAmount;
  if (raw === undefined || raw === null) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (Number.isNaN(n) || n === 0) return null;
  return Math.abs(n);
}

export async function scrapeMaxTransactions(
  username: string,
  password: string,
  startDate: Date,
  endDate: Date
): Promise<ScrapedRow[]> {
  const scraper = createScraper({
    companyId: CompanyTypes.Max,
    startDate,
    defaultTimeout: 120000,
  });

  scraper.onProgress((_companyId, payload) => {
    const stage =
      typeof payload === "object" && payload && "type" in payload
        ? String((payload as { type?: string }).type)
        : String(payload);
    console.log(`MAX scrape: ${stage}`);
  });

  const result = await keepEventLoopAlive(() =>
    scraper.scrape({ username, password })
  );

  if (!result.success) {
    throw new Error(result.errorMessage ?? result.errorType ?? "MAX scrape failed");
  }

  const rows: ScrapedRow[] = [];

  for (const account of result.accounts ?? []) {
    for (const tx of (account.txns ?? []) as ScraperTransaction[]) {
      const date = parseScraperDate(tx.processedDate) ?? parseScraperDate(tx.date);
      const amount = parseAmount(tx);
      if (!date || !amount) {
        continue;
      }

      const merchantDisplay = (tx.description || tx.memo || "Unknown").trim();
      const merchantNormalized = normalizeMerchant(merchantDisplay);
      if (!merchantNormalized) {
        continue;
      }

      rows.push({
        date,
        amount,
        merchantDisplay,
        merchantNormalized,
        sourceKey: buildSourceKey(date, amount, merchantNormalized),
      });
    }
  }

  return rows;
}
