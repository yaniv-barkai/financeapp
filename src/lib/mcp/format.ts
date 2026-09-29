import { Category, Tag, Transaction } from "@/lib/types";

/** Anything with toDate(): client and admin Firestore Timestamps both qualify. */
interface DateLike {
  toDate(): Date;
}

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatDay(value: DateLike | Date | undefined | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : value.toDate();
  return dayFormatter.format(date);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function categoryNameMap(categories: Category[]): Map<string, string> {
  return new Map(categories.map((c) => [c.id, c.nameEn ? `${c.name} (${c.nameEn})` : c.name]));
}

export function tagNameMap(tags: Tag[]): Map<string, string> {
  return new Map(tags.map((t) => [t.id, t.name]));
}

export function serializeTransaction(
  tx: Transaction,
  categories: Map<string, string>,
  tags: Map<string, string>
) {
  return {
    id: tx.id,
    date: formatDay(tx.date),
    type: tx.type,
    amount: round2(tx.amount),
    categoryId: tx.categoryId,
    category: categories.get(tx.categoryId) ?? null,
    merchant: tx.merchantDisplay ?? null,
    note: tx.note ?? null,
    tags: (tx.tags ?? []).map((id) => tags.get(id) ?? id),
    ...(tx.installments && {
      installment: `${tx.installments.number}/${tx.installments.total}`,
      originalAmount: tx.originalAmount,
    }),
    ...(tx.splits?.length && {
      splits: tx.splits.map((s) => ({
        categoryId: s.categoryId,
        category: categories.get(s.categoryId) ?? null,
        amount: round2(s.amount),
      })),
    }),
    source: tx.source ?? "manual",
  };
}
