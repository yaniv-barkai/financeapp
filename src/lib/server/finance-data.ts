import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { monthKeyToProjection, projectionMonthKey } from "@/lib/debt-due";
import {
  Book,
  Category,
  Debt,
  Merchant,
  Recurring,
  SnowballOneTimeIncome,
  SnowballPlan,
  Tag,
  Task,
  Transaction,
  UserSettings,
} from "@/lib/types";
import { getPrevMonthKey } from "@/lib/utils";

/**
 * Admin-SDK reads/writes bypass firestore.rules: callers must pass a uid that came
 * from a verified credential, and a bookId checked with resolveBookId().
 */

function bookPath(uid: string, bookId: string): string {
  return `users/${uid}/books/${bookId}`;
}

function withoutUndefined<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as T;
}

export class BookNotFoundError extends Error {
  constructor(bookId: string) {
    super(`Book not found: ${bookId}`);
    this.name = "BookNotFoundError";
  }
}

export async function loadUserSettings(uid: string): Promise<UserSettings | null> {
  const snap = await getAdminFirestore().doc(`users/${uid}`).get();
  return snap.exists ? (snap.data() as UserSettings) : null;
}

export async function loadBooks(uid: string): Promise<Book[]> {
  const snap = await getAdminFirestore()
    .collection(`users/${uid}/books`)
    .orderBy("createdAt")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Book);
}

/** Returns an owned book id: the requested one, else the default, else the first book. */
export async function resolveBookId(uid: string, bookId?: string): Promise<string> {
  const db = getAdminFirestore();
  if (bookId) {
    if (bookId.includes("/")) throw new BookNotFoundError(bookId);
    const snap = await db.doc(bookPath(uid, bookId)).get();
    if (!snap.exists) throw new BookNotFoundError(bookId);
    return bookId;
  }
  const settings = await loadUserSettings(uid);
  if (settings?.defaultBookId) {
    const snap = await db.doc(bookPath(uid, settings.defaultBookId)).get();
    if (snap.exists) return settings.defaultBookId;
  }
  const books = await loadBooks(uid);
  if (!books.length) throw new BookNotFoundError("(none)");
  return books[0].id;
}

export async function loadCategories(uid: string, bookId: string): Promise<Category[]> {
  const snap = await getAdminFirestore()
    .collection(`${bookPath(uid, bookId)}/categories`)
    .orderBy("order")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category);
}

function parseLimitDoc(data: Record<string, unknown>): number {
  if (data.budgetAmount !== undefined) {
    const amount = data.budgetAmount as number;
    const period = (data.budgetPeriod as string) ?? "monthly";
    return period === "yearly" ? amount / 12 : amount;
  }
  return (data.monthlyLimit as number) ?? 0;
}

export async function loadMonthlyBudgetAmounts(
  uid: string,
  bookId: string,
  monthKey: string
): Promise<Record<string, number> | null> {
  const snap = await getAdminFirestore()
    .doc(`${bookPath(uid, bookId)}/monthlyBudgets/${monthKey}`)
    .get();
  if (!snap.exists) return null;
  const amounts = (snap.data()?.amounts as Record<string, number>) ?? {};
  const cleaned: Record<string, number> = {};
  for (const [catId, amount] of Object.entries(amounts)) {
    if (typeof amount === "number" && amount > 0) cleaned[catId] = amount;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

async function loadLegacyLimits(
  uid: string,
  bookId: string,
  categories: Category[]
): Promise<Record<string, number>> {
  const db = getAdminFirestore();
  const limits: Record<string, number> = {};
  await Promise.all(
    categories.map(async (c) => {
      const snap = await db
        .doc(`${bookPath(uid, bookId)}/categories/${c.id}/limits/default`)
        .get();
      if (snap.exists) {
        const monthly = parseLimitDoc(snap.data() as Record<string, unknown>);
        if (monthly > 0) limits[c.id] = monthly;
      }
    })
  );
  return limits;
}

/** Prefer this month's monthly budget, else previous month, else legacy limits. */
export async function loadLimits(
  uid: string,
  bookId: string,
  monthKey: string,
  categories: Category[]
): Promise<Record<string, number>> {
  const current = await loadMonthlyBudgetAmounts(uid, bookId, monthKey);
  if (current) return current;

  const prev = await loadMonthlyBudgetAmounts(uid, bookId, getPrevMonthKey(monthKey));
  if (prev) return prev;

  return loadLegacyLimits(uid, bookId, categories);
}

export async function loadMonthTransactions(
  uid: string,
  bookId: string,
  start: Date,
  end: Date
): Promise<Transaction[]> {
  const snap = await getAdminFirestore()
    .collection(`${bookPath(uid, bookId)}/transactions`)
    .where("date", ">=", Timestamp.fromDate(start))
    .where("date", "<=", Timestamp.fromDate(end))
    .orderBy("date", "desc")
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction);
}

export async function loadTransaction(
  uid: string,
  bookId: string,
  txId: string
): Promise<Transaction | null> {
  const snap = await getAdminFirestore()
    .doc(`${bookPath(uid, bookId)}/transactions/${txId}`)
    .get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Transaction) : null;
}

export async function loadRecurring(uid: string, bookId: string): Promise<Recurring[]> {
  const snap = await getAdminFirestore().collection(`${bookPath(uid, bookId)}/recurring`).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Recurring);
}

export async function loadDebts(uid: string, bookId: string): Promise<Debt[]> {
  const snap = await getAdminFirestore().collection(`${bookPath(uid, bookId)}/debts`).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: (data.name as string) ?? "",
      balance: Number(data.balance) || 0,
      monthlyPayment: Number(data.monthlyPayment) || 0,
      interestType: data.interestType === "prime" ? "prime" : "fixed",
      annualInterestRate: Number(data.annualInterestRate) || 0,
      primeMargin: Number(data.primeMargin) || 0,
      forcePhase1: Boolean(data.forcePhase1),
      payoffOrder: typeof data.payoffOrder === "number" ? data.payoffOrder : undefined,
      recurringId: data.recurringId as string | undefined,
      transactionIds: (data.transactionIds as string[]) ?? [],
      matchMerchants: (data.matchMerchants as string[]) ?? [],
      categoryId: data.categoryId as string | undefined,
      note: data.note as string | undefined,
      dueDate: (data.dueDate as string) || undefined,
      status: (data.status as Debt["status"]) ?? "open",
      createdAt: data.createdAt,
    } as Debt;
  });
}

function normalizeOneTime(item: SnowballOneTimeIncome): SnowballOneTimeIncome {
  const projection = item.applyMonth ? monthKeyToProjection(item.applyMonth) : null;
  if (item.applyMonth && projection !== null) {
    return { ...item, applyAfterMonths: projection - 1 };
  }
  const after = Math.max(0, Number(item.applyAfterMonths) || 0);
  return { ...item, applyAfterMonths: after, applyMonth: projectionMonthKey(after + 1) };
}

export async function loadDebtPlan(uid: string, bookId: string): Promise<SnowballPlan | null> {
  const snap = await getAdminFirestore().doc(`${bookPath(uid, bookId)}/debtPlans/main`).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return {
    nominalMonthlyIncome: Number(data.nominalMonthlyIncome) || 0,
    monthlyExtra: Number(data.monthlyExtra) || 0,
    oneTimeIncomes: ((data.oneTimeIncomes as SnowballOneTimeIncome[]) ?? []).map(
      normalizeOneTime
    ),
    emergencyFundMonths:
      data.emergencyFundMonths === undefined ? 3 : Number(data.emergencyFundMonths) || 0,
    monthlyIncomeForFund: Number(data.monthlyIncomeForFund) || 0,
  };
}

export async function loadTasks(uid: string, bookId: string): Promise<Task[]> {
  const snap = await getAdminFirestore().collection(`${bookPath(uid, bookId)}/tasks`).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Task);
}

export async function loadTags(uid: string, bookId: string): Promise<Tag[]> {
  const snap = await getAdminFirestore().collection(`${bookPath(uid, bookId)}/tags`).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Tag);
}

export async function loadMerchant(
  uid: string,
  bookId: string,
  normalized: string
): Promise<Merchant | null> {
  if (!normalized) return null;
  const snap = await getAdminFirestore()
    .doc(`${bookPath(uid, bookId)}/merchants/${normalized}`)
    .get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Merchant) : null;
}

export async function addTransactionAdmin(
  uid: string,
  bookId: string,
  data: Omit<Transaction, "id" | "createdAt" | "date"> & { date: Date }
): Promise<string> {
  const ref = await getAdminFirestore()
    .collection(`${bookPath(uid, bookId)}/transactions`)
    .add(
      withoutUndefined({
        ...data,
        date: Timestamp.fromDate(data.date),
        createdAt: FieldValue.serverTimestamp(),
      })
    );
  return ref.id;
}

export async function updateTransactionAdmin(
  uid: string,
  bookId: string,
  txId: string,
  data: Partial<Pick<Transaction, "categoryId" | "note" | "tags">>
): Promise<void> {
  await getAdminFirestore()
    .doc(`${bookPath(uid, bookId)}/transactions/${txId}`)
    .update(withoutUndefined(data));
}

/** Same merchant memory update the UI does after saving or recategorizing. */
export async function upsertMerchantAdmin(
  uid: string,
  bookId: string,
  normalized: string,
  displayName: string,
  categoryId: string
): Promise<void> {
  if (!normalized) return;
  await getAdminFirestore()
    .doc(`${bookPath(uid, bookId)}/merchants/${normalized}`)
    .set(
      {
        displayName,
        defaultCategoryId: categoryId,
        count: FieldValue.increment(1),
        lastSeenAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

export async function loadTask(uid: string, bookId: string, taskId: string): Promise<Task | null> {
  const snap = await getAdminFirestore().doc(`${bookPath(uid, bookId)}/tasks/${taskId}`).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Task) : null;
}

export async function addTaskAdmin(
  uid: string,
  bookId: string,
  data: Omit<Task, "id" | "createdAt" | "endDate"> & { endDate: Date }
): Promise<string> {
  const ref = await getAdminFirestore()
    .collection(`${bookPath(uid, bookId)}/tasks`)
    .add(
      withoutUndefined({
        ...data,
        endDate: Timestamp.fromDate(data.endDate),
        createdAt: FieldValue.serverTimestamp(),
      })
    );
  return ref.id;
}

export async function updateTaskAdmin(
  uid: string,
  bookId: string,
  taskId: string,
  data: Partial<Pick<Task, "status">>
): Promise<void> {
  await getAdminFirestore()
    .doc(`${bookPath(uid, bookId)}/tasks/${taskId}`)
    .update(withoutUndefined(data));
}
