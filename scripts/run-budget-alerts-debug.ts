/**
 * Local debug runner for budget email alerts.
 * Usage:
 *   DEBUG_RUN_ID=pre-fix BUDGET_ALERTS_IGNORE_STATE=1 npx tsx scripts/run-budget-alerts-debug.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

async function main() {
  const { runBudgetAlertsForAllConfiguredUsers } = await import(
    "../src/lib/server/budget-alerts"
  );
  const sent = await runBudgetAlertsForAllConfiguredUsers();
  console.log(JSON.stringify({ ok: true, emailsSent: sent }));
  // Let debug ingest fetch() calls flush before exit
  await new Promise((r) => setTimeout(r, 500));
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await new Promise((r) => setTimeout(r, 500));
  process.exit(1);
});