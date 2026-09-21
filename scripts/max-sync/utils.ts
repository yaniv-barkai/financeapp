export function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s*#?\d{3,}\s*/g, " ")
    .replace(/\b(inc|ltd|llc|corp|co|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Calendar day in Israel (MAX is an Israeli card). Avoid UTC day shifts. */
export function israelCalendarDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Canonical stored instant for an Israel calendar day: local midnight
 * (e.g. 2026-08-26 → 2026-08-25T21:00:00.000Z in summer).
 * Keeps scrape date shapes (UTC midnight vs Asia/Jerusalem midnight) aligned.
 */
export function toIsraelMidnight(date: Date): Date {
  const day = israelCalendarDay(date);
  // Probe noon UTC on that civil day to learn the Israel UTC offset (DST-safe).
  const noonUtc = new Date(`${day}T12:00:00.000Z`);
  const hourInIsrael = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      hour: "2-digit",
      hour12: false,
    }).format(noonUtc)
  );
  const offsetHours = (hourInIsrael === 24 ? 0 : hourInIsrael) - 12;
  return new Date(
    Date.UTC(
      Number(day.slice(0, 4)),
      Number(day.slice(5, 7)) - 1,
      Number(day.slice(8, 10)),
      -offsetHours,
      0,
      0,
      0
    )
  );
}

export function buildSourceKey(
  date: Date,
  amount: number,
  merchantNormalized: string,
  installments?: { number: number; total: number } | null
): string {
  const day = israelCalendarDay(date);
  const base = `max:${day}:${amount.toFixed(2)}:${merchantNormalized}`;
  if (!installments) return base;
  return `${base}:${installments.number}/${installments.total}`;
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
