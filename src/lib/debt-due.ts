const DAY_MS = 86_400_000;

export const DUE_SOON_DAYS = 30;

/** "YYYY-MM-DD" → local midnight Date (avoids UTC off-by-one). */
export function parseDueDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Negative = overdue, 0 = today. */
export function daysUntilDue(value: string): number | null {
  const due = parseDueDate(value);
  if (!due) return null;
  return Math.round((due.getTime() - startOfToday().getTime()) / DAY_MS);
}

/** Last day of the month that is `months` months from now (projection month N). */
export function projectionMonthEnd(months: number): Date {
  const today = startOfToday();
  return new Date(today.getFullYear(), today.getMonth() + months + 1, 0);
}

/** "YYYY-MM" of projection month N. */
export function projectionMonthKey(months: number): string {
  const d = projectionMonthEnd(months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "YYYY-MM" → projection month N (0 = this month, negative = past), or null if invalid. */
export function monthKeyToProjection(key: string): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const today = startOfToday();
  return (
    (Number(m[1]) - today.getFullYear()) * 12 +
    (Number(m[2]) - 1 - today.getMonth())
  );
}
