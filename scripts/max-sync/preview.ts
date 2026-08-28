import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "./load-env.js";
import { scrapeMaxTransactions } from "./scrape.js";
import { requireEnv } from "./utils.js";

const packageDir = dirname(fileURLToPath(import.meta.url));
const previewPath = resolve(packageDir, "last-scrape-preview.json");

function subtractDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

async function main() {
  const username = requireEnv("MAX_USERNAME");
  const password = requireEnv("MAX_PASSWORD");

  const endDate = new Date();
  const daysBack = Number(process.env.PREVIEW_DAYS ?? "90");
  const startDate = subtractDays(endDate, daysBack);

  console.log("MAX preview — scrape only (nothing written to Firestore)");
  console.log(`Date range: ${startDate.toISOString().slice(0, 10)} → ${endDate.toISOString().slice(0, 10)}`);
  console.log("This may take 1–3 minutes (browser login)…\n");

  const rows = await scrapeMaxTransactions(username, password, startDate, endDate);

  console.log(`Found ${rows.length} transaction(s):\n`);
  console.log("Date       Amount    Merchant");
  console.log("─────────  ────────  ─────────────────────────");

  const sorted = [...rows].sort((a, b) => b.date.getTime() - a.date.getTime());
  for (const row of sorted.slice(0, 30)) {
    const day = row.date.toISOString().slice(0, 10);
    const amt = row.amount.toFixed(2).padStart(8);
    console.log(`${day}  ${amt}  ${row.merchantDisplay}`);
  }
  if (sorted.length > 30) {
    console.log(`… and ${sorted.length - 30} more (see JSON file)`);
  }

  const payload = sorted.map((row) => ({
    date: row.date.toISOString().slice(0, 10),
    amount: row.amount,
    merchant: row.merchantDisplay,
    merchantNormalized: row.merchantNormalized,
    sourceKey: row.sourceKey,
  }));

  writeFileSync(previewPath, JSON.stringify(payload, null, 2));
  console.log(`\nFull list saved to: ${previewPath}`);
}

main().catch((err) => {
  console.error("Preview failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
