import { createScraper, CompanyTypes } from "@sergienko4/israeli-bank-scrapers";
import type { ScrapedRow } from "./import.js";
import {
  extractMaxTxnRows,
  mapMaxRawTransactions,
  type MaxRawTxn,
} from "./max-installments.js";
import {
  buildSourceKey,
  keepEventLoopAlive,
  normalizeMerchant,
  toIsraelMidnight,
} from "./utils.js";

interface ScraperTransaction {
  description?: string;
  memo?: string;
  chargedAmount?: number;
  originalAmount?: number;
  date?: string | Date;
  processedDate?: string | Date;
  type?: string;
  installments?: { number: number; total: number };
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
  // Card scrapers use negative for charges; positive is a credit/refund.
  // Skip credits here — Max installment conversion emits a canceling credit.
  if (Number.isNaN(n) || n >= 0) return null;
  return Math.abs(n);
}

function toScrapedRow(input: {
  date: Date;
  amount: number;
  merchantDisplay: string;
  note?: string;
  installments?: { number: number; total: number };
  originalAmount?: number;
}): ScrapedRow | null {
  const merchantNormalized = normalizeMerchant(input.merchantDisplay);
  if (!merchantNormalized) return null;

  const canonicalDate = toIsraelMidnight(input.date);
  return {
    date: canonicalDate,
    amount: input.amount,
    merchantDisplay: input.merchantDisplay,
    merchantNormalized,
    sourceKey: buildSourceKey(
      canonicalDate,
      input.amount,
      merchantNormalized,
      input.installments
    ),
    ...(input.note ? { note: input.note } : {}),
    ...(input.installments ? { installments: input.installments } : {}),
    ...(input.originalAmount != null
      ? { originalAmount: input.originalAmount }
      : {}),
  };
}

function mapFromRawBodies(bodies: unknown[]): ScrapedRow[] {
  const rawRows: MaxRawTxn[] = [];
  for (const body of bodies) {
    rawRows.push(...extractMaxTxnRows(body));
  }
  if (!rawRows.length) return [];

  const mapped = mapMaxRawTransactions(rawRows);
  const rows: ScrapedRow[] = [];
  for (const m of mapped) {
    const row = toScrapedRow(m);
    if (row) rows.push(row);
  }
  return rows;
}

function mapFromScraperTxns(txns: ScraperTransaction[]): ScrapedRow[] {
  const rows: ScrapedRow[] = [];
  for (const tx of txns) {
    const date = parseScraperDate(tx.processedDate) ?? parseScraperDate(tx.date);
    const amount = parseAmount(tx);
    if (!date || !amount) continue;

    const merchantDisplay = (tx.description || tx.memo || "Unknown").trim();
    const installments = tx.installments;
    const originalAbs =
      tx.originalAmount != null ? Math.abs(Number(tx.originalAmount)) : undefined;
    const note =
      installments != null
        ? `תשלום ${installments.number} מתוך ${installments.total}`
        : tx.memo?.trim() || undefined;

    const row = toScrapedRow({
      date,
      amount,
      merchantDisplay,
      note,
      installments,
      originalAmount:
        originalAbs != null && Math.abs(originalAbs - amount) >= 0.005
          ? originalAbs
          : undefined,
    });
    if (row) rows.push(row);
  }
  return rows;
}

export async function scrapeMaxTransactions(
  username: string,
  password: string,
  startDate: Date,
  _endDate: Date
): Promise<ScrapedRow[]> {
  const capturedBodies: unknown[] = [];

  const scraper = createScraper({
    companyId: CompanyTypes.Max,
    startDate,
    // Include next months so scheduled installment payments are visible.
    futureMonthsToScrape: 3,
    defaultTimeout: 120000,
    preparePage: async (page) => {
      page.on("response", async (response) => {
        try {
          const url = response.url();
          if (!/getTransactionsAndGraphs|transactionDetails/i.test(url)) return;
          const json = await response.json();
          capturedBodies.push(json);
        } catch {
          // ignore non-json / aborted
        }
      });
    },
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

  const fromRaw = mapFromRawBodies(capturedBodies);
  if (fromRaw.length) {
    const deduped = dedupeRows(fromRaw);
    console.log(
      `MAX scrape: mapped ${deduped.length} txn(s) from raw API (${capturedBodies.length} bodies, ${fromRaw.length} before dedupe)`
    );
    return deduped;
  }

  console.warn(
    "MAX scrape: raw API capture empty — falling back to scraper txns (installment dates may be wrong)"
  );

  const scraped: ScraperTransaction[] = [];
  for (const account of result.accounts ?? []) {
    scraped.push(...((account.txns ?? []) as ScraperTransaction[]));
  }
  return dedupeRows(mapFromScraperTxns(scraped));
}

function dedupeRows(rows: ScrapedRow[]): ScrapedRow[] {
  const seen = new Set<string>();
  const out: ScrapedRow[] = [];
  for (const row of rows) {
    if (seen.has(row.sourceKey)) continue;
    seen.add(row.sourceKey);
    out.push(row);
  }
  return out;
}
