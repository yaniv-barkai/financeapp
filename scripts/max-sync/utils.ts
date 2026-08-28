export function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s*#?\d{3,}\s*/g, " ")
    .replace(/\b(inc|ltd|llc|corp|co|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSourceKey(date: Date, amount: number, merchantNormalized: string): string {
  const day = date.toISOString().slice(0, 10);
  return `max:${day}:${amount.toFixed(2)}:${merchantNormalized}`;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

/** Scraper work can briefly leave no active handles; Node exits before scrape settles. */
export async function keepEventLoopAlive<T>(run: () => Promise<T>): Promise<T> {
  const keepAlive = setInterval(() => {}, 500);
  try {
    return await run();
  } finally {
    clearInterval(keepAlive);
  }
}
