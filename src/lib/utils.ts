import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { getIntlLocale } from "@/lib/i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD", locale?: string): string {
  return new Intl.NumberFormat(locale ?? getIntlLocale(), {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale ?? getIntlLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function normalizemerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s*#?\d{3,}\s*/g, " ")
    .replace(/\b(inc|ltd|llc|corp|co|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthKey(key: string): Date {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

export function getMonthRange(monthKey: string): { start: Date; end: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

export function getCategoryDisplayName(
  cat: { name: string; nameEn?: string },
  locale: string
): string {
  return locale === "en" && cat.nameEn ? cat.nameEn : cat.name;
}

/** Free translation via MyMemory (no API key, ~500 req/day per IP). */
export async function translateHeToEn(text: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=he|en`
    );
    const data = await res.json();
    const translated: string = data?.responseData?.translatedText ?? "";
    return translated || text;
  } catch {
    return text;
  }
}
