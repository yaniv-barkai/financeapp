import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  buildCategoryBudgetRows,
  computeExpenseByCategory,
  findNewThresholdCrossings,
} from "@/lib/budget";
import { Category, Transaction, UserSettings } from "@/lib/types";
import { getMonthKey, getMonthRange } from "@/lib/utils";

const DEFAULT_THRESHOLDS = [80, 100];

function parseLimitDoc(data: Record<string, unknown>): number {
  if (data.budgetAmount !== undefined) {
    const amount = data.budgetAmount as number;
    const period = (data.budgetPeriod as string) ?? "monthly";
    return period === "yearly" ? amount / 12 : amount;
  }
  return (data.monthlyLimit as number) ?? 0;
}

async function loadCategories(uid: string, bookId: string): Promise<Category[]> {
  const snap = await getAdminFirestore()
    .collection(`users/${uid}/books/${bookId}/categories`)
    .orderBy("order")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category);
}

async function loadLimits(
  uid: string,
  bookId: string,
  categories: Category[]
): Promise<Record<string, number>> {
  const db = getAdminFirestore();
  const limits: Record<string, number> = {};
  await Promise.all(
    categories.map(async (c) => {
      const snap = await db
        .doc(`users/${uid}/books/${bookId}/categories/${c.id}/limits/default`)
        .get();
      if (snap.exists) {
        const monthly = parseLimitDoc(snap.data() as Record<string, unknown>);
        if (monthly > 0) limits[c.id] = monthly;
      }
    })
  );
  return limits;
}

async function loadMonthTransactions(
  uid: string,
  bookId: string,
  start: Date,
  end: Date
): Promise<Transaction[]> {
  const snap = await getAdminFirestore()
    .collection(`users/${uid}/books/${bookId}/transactions`)
    .where("date", ">=", Timestamp.fromDate(start))
    .where("date", "<=", Timestamp.fromDate(end))
    .orderBy("date", "desc")
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction);
}

async function loadAlertState(
  uid: string,
  monthKey: string
): Promise<Record<string, number>> {
  const snap = await getAdminFirestore()
    .collection(`users/${uid}/alertState`)
    .get();
  const prefix = `${monthKey}_`;
  const map: Record<string, number> = {};
  for (const doc of snap.docs) {
    if (!doc.id.startsWith(prefix)) continue;
    const catId = doc.id.slice(prefix.length);
    const data = doc.data();
    map[catId] = (data.lastThresholdSent as number) ?? 0;
  }
  return map;
}

async function saveAlertState(
  uid: string,
  monthKey: string,
  catId: string,
  threshold: number
): Promise<void> {
  await getAdminFirestore()
    .doc(`users/${uid}/alertState/${monthKey}_${catId}`)
    .set({
      lastThresholdSent: threshold,
      sentAt: Timestamp.now(),
    });
}

async function sendBudgetEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IL", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export async function runBudgetAlertsForUser(uid: string): Promise<number> {
  const userSnap = await getAdminFirestore().doc(`users/${uid}`).get();
  if (!userSnap.exists) return 0;

  const settings = userSnap.data() as UserSettings;
  const alertSettings = settings.alertSettings;
  if (alertSettings?.emailEnabled === false) return 0;

  const thresholds = alertSettings?.thresholds?.length
    ? alertSettings.thresholds
    : DEFAULT_THRESHOLDS;

  const bookId = settings.maxSync?.bookId ?? settings.defaultBookId;
  if (!bookId) return 0;

  const monthKey = getMonthKey(new Date());
  const { start, end } = getMonthRange(monthKey);
  const currency = settings.currency ?? "ILS";

  const categories = await loadCategories(uid, bookId);
  const [limits, transactions, alreadySent] = await Promise.all([
    loadLimits(uid, bookId, categories),
    loadMonthTransactions(uid, bookId, start, end),
    loadAlertState(uid, monthKey),
  ]);

  const expenseByCategory = computeExpenseByCategory(transactions);
  const rows = buildCategoryBudgetRows(categories, limits, expenseByCategory);
  const crossings = findNewThresholdCrossings(rows, thresholds, alreadySent);

  if (!crossings.length) return 0;

  const auth = await import("firebase-admin/auth").then((m) => m.getAuth());
  const userRecord = await auth.getUser(uid);
  const to = alertSettings?.alertEmail ?? userRecord.email;
  if (!to) return 0;

  let sent = 0;
  for (const crossing of crossings) {
    const remaining = Math.max(0, crossing.limit - crossing.spent);
    const isOver = crossing.threshold >= 100;
    const subject = isOver
      ? `Budget exceeded: ${crossing.categoryName}`
      : `Budget warning: ${crossing.categoryName} at ${Math.round(crossing.pct)}%`;

    const html = `
      <p>Category <strong>${crossing.categoryName}</strong> is at
      <strong>${Math.round(crossing.pct)}%</strong> of your monthly budget
      (${formatMoney(crossing.spent, currency)} / ${formatMoney(crossing.limit, currency)}).</p>
      <p>${isOver
        ? `You are ${formatMoney(crossing.spent - crossing.limit, currency)} over budget.`
        : `${formatMoney(remaining, currency)} remaining.`}</p>
    `;

    await sendBudgetEmail(to, subject, html);
    await saveAlertState(uid, monthKey, crossing.catId, crossing.threshold);
    sent++;
  }

  return sent;
}

export async function runBudgetAlertsForAllConfiguredUsers(): Promise<number> {
  const targetUid = process.env.SYNC_USER_UID;
  if (targetUid) {
    return runBudgetAlertsForUser(targetUid);
  }

  const snap = await getAdminFirestore().collection("users").get();
  let total = 0;
  for (const doc of snap.docs) {
    const data = doc.data() as UserSettings;
    if (data.alertSettings?.emailEnabled !== false) {
      total += await runBudgetAlertsForUser(doc.id);
    }
  }
  return total;
}
