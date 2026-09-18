import { Timestamp } from "firebase-admin/firestore";
import { getISOWeek, getISOWeekYear, startOfDay, startOfMonth, subMonths } from "date-fns";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { computeExpenseByCategory } from "@/lib/budget";
import {
  evaluateGuide,
  findMismatchCategoryIds,
  GUIDE_SETUP_EMAIL_MIN_ACCOUNT_DAYS,
  isGuideBudgetComplete,
  monthKeysFromDates,
} from "@/lib/guide/evaluate";
import { guideItemReason, guideItemTitle } from "@/lib/guide/copy";
import { translations, Locale } from "@/lib/i18n";
import {
  Category,
  GuideItem,
  Recurring,
  Task,
  Transaction,
  UserSettings,
} from "@/lib/types";
import {
  getMonthKey,
  getMonthRange,
  getNextMonthKey,
} from "@/lib/utils";

function toMonthly(amount: number, cadence: Recurring["cadence"]): number {
  switch (cadence) {
    case "weekly":
      return (amount * 52) / 12;
    case "monthly":
      return amount;
    case "yearly":
      return amount / 12;
  }
}

function isoWeekKey(date: Date): string {
  return `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, "0")}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadCategories(uid: string, bookId: string): Promise<Category[]> {
  const snap = await getAdminFirestore()
    .collection(`users/${uid}/books/${bookId}/categories`)
    .orderBy("order")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category);
}

async function loadMonthlyBudgetAmounts(
  uid: string,
  bookId: string,
  monthKey: string
): Promise<Record<string, number> | null> {
  const snap = await getAdminFirestore()
    .doc(`users/${uid}/books/${bookId}/monthlyBudgets/${monthKey}`)
    .get();
  if (!snap.exists) return null;
  const amounts = (snap.data()?.amounts as Record<string, number>) ?? {};
  const cleaned: Record<string, number> = {};
  for (const [catId, amount] of Object.entries(amounts)) {
    if (typeof amount === "number" && amount > 0) cleaned[catId] = amount;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

async function loadTxRange(
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

async function alertStateExists(uid: string, stateId: string): Promise<boolean> {
  return (
    await getAdminFirestore().doc(`users/${uid}/alertState/${stateId}`).get()
  ).exists;
}

async function saveGuideAlertState(uid: string, stateId: string): Promise<void> {
  await getAdminFirestore()
    .doc(`users/${uid}/alertState/${stateId}`)
    .set({ lastThresholdSent: 1, sentAt: Timestamp.now() });
}

export interface GuideEmailSend {
  subject: string;
  html: string;
  stateIds: string[];
}

/** Build a guide digest email if any nudge is due. Returns null when nothing to send. */
export async function buildGuideEmailDigest(
  uid: string,
  settings: UserSettings,
  opts?: {
    ignoreState?: boolean;
    /** Category ids that already received a 100% threshold email this month */
    skipMismatchCatIds?: Set<string>;
  }
): Promise<GuideEmailSend | null> {
  if (settings.alertSettings?.guideEmailEnabled === false) return null;

  const bookId = settings.maxSync?.bookId ?? settings.defaultBookId;
  if (!bookId) return null;

  const now = new Date();
  const monthKey = getMonthKey(now);
  const nextMonthKey = getNextMonthKey(monthKey);
  const historyStart = startOfMonth(subMonths(now, 2));
  const { start: monthStart, end: monthEnd } = getMonthRange(monthKey);
  const weekKey = isoWeekKey(now);
  const ignoreState = opts?.ignoreState ?? false;

  const [
    categories,
    currentAmounts,
    nextAmounts,
    historyTxs,
    monthTxs,
    recurringSnap,
    tasksSnap,
    guideStateSnap,
  ] = await Promise.all([
    loadCategories(uid, bookId),
    loadMonthlyBudgetAmounts(uid, bookId, monthKey),
    loadMonthlyBudgetAmounts(uid, bookId, nextMonthKey),
    loadTxRange(uid, bookId, historyStart, monthEnd),
    loadTxRange(uid, bookId, monthStart, monthEnd),
    getAdminFirestore().collection(`users/${uid}/books/${bookId}/recurring`).get(),
    getAdminFirestore().collection(`users/${uid}/books/${bookId}/tasks`).get(),
    getAdminFirestore().doc(`users/${uid}/books/${bookId}/guideState/main`).get(),
  ]);

  const recurrings = recurringSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as Recurring
  );
  const tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Task);
  const guideState = guideStateSnap.exists ? guideStateSnap.data() : {};

  const recurringByCat: Record<string, number> = {};
  let hasActiveExpenseRecurring = false;
  let monthlyIncome = 0;
  for (const r of recurrings.filter((x) => x.active)) {
    const monthly = toMonthly(r.amount, r.cadence);
    if (r.type === "expense") {
      hasActiveExpenseRecurring = true;
      recurringByCat[r.categoryId] = (recurringByCat[r.categoryId] ?? 0) + monthly;
    } else if (r.type === "income") {
      monthlyIncome += monthly;
    }
  }

  const spentByCat = computeExpenseByCategory(monthTxs);
  const budgetAmounts = currentAmounts ?? {};
  let mismatchCategoryIds = findMismatchCategoryIds(
    categories.filter((c) => c.type === "expense").map((c) => c.id),
    spentByCat,
    budgetAmounts,
    recurringByCat
  );
  if (opts?.skipMismatchCatIds?.size) {
    mismatchCategoryIds = mismatchCategoryIds.filter(
      (id) => !opts.skipMismatchCatIds!.has(id)
    );
  }

  let recentActivityAt: Date | null = null;
  for (const tx of historyTxs) {
    const created = (tx.createdAt as Timestamp | undefined)?.toDate?.();
    if (created && (!recentActivityAt || created > recentActivityAt)) {
      recentActivityAt = created;
    }
  }
  const maxSyncAt = settings.maxSync?.lastSyncAt?.toDate?.() ?? null;
  if (maxSyncAt && (!recentActivityAt || maxSyncAt > recentActivityAt)) {
    recentActivityAt = maxSyncAt;
  }

  const todayStart = startOfDay(now);
  const overdueTaskCount = tasks.filter((task) => {
    if (task.status !== "open") return false;
    const end = task.endDate?.toDate?.();
    return end ? end < todayStart : false;
  }).length;

  const snoozedUntil: Record<string, Date> = {};
  const rawSnooze = (guideState?.snoozedUntil ?? {}) as Record<string, Timestamp>;
  for (const [id, ts] of Object.entries(rawSnooze)) {
    if (ts?.toDate) snoozedUntil[id] = ts.toDate();
  }

  const reviewedRaw = guideState?.categoriesReviewedAt as Timestamp | undefined;
  const result = evaluateGuide({
    now,
    categories,
    categoriesReviewedAt: reviewedRaw?.toDate?.() ?? null,
    transactionMonthKeys: monthKeysFromDates(historyTxs.map((tx) => tx.date.toDate())),
    recentActivityAt,
    hasActiveExpenseRecurring,
    currentBudgetSet: isGuideBudgetComplete(currentAmounts, monthlyIncome),
    nextBudgetSet: isGuideBudgetComplete(nextAmounts, monthlyIncome),
    mismatchCategoryIds,
    overdueTaskCount,
    snoozedUntil,
  });

  const createdAt = settings.createdAt?.toDate?.() ?? null;
  const accountAgeDays = createdAt
    ? (now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000)
    : GUIDE_SETUP_EMAIL_MIN_ACCOUNT_DAYS + 1;

  const sections: Array<{ kind: string; items: GuideItem[]; stateId: string }> = [];

  const setupStateId = `guide_setup_${weekKey}`;
  if (
    !result.setupComplete &&
    accountAgeDays >= GUIDE_SETUP_EMAIL_MIN_ACCOUNT_DAYS &&
    result.setup.length > 0
  ) {
    const already = ignoreState ? false : await alertStateExists(uid, setupStateId);
    if (!already) {
      sections.push({ kind: "setup", items: result.setup, stateId: setupStateId });
    }
  }

  const staleStateId = `guide_stale_${weekKey}`;
  const staleItem = result.habits.find((h) => h.id === "habit_weekly_activity");
  if (staleItem) {
    const already = ignoreState ? false : await alertStateExists(uid, staleStateId);
    if (!already) {
      sections.push({ kind: "stale", items: [staleItem], stateId: staleStateId });
    }
  }

  const mismatchStateId = `guide_mismatch_${monthKey}`;
  const mismatchItem = result.habits.find((h) => h.id === "habit_budget_mismatch");
  if (mismatchItem) {
    const already = ignoreState ? false : await alertStateExists(uid, mismatchStateId);
    if (!already) {
      sections.push({ kind: "mismatch", items: [mismatchItem], stateId: mismatchStateId });
    }
  }

  if (sections.length === 0) return null;

  const locale: Locale = settings.locale === "he" ? "he" : "en";
  const t = translations[locale];
  const rtl = locale === "he";
  const appUrl =
    process.env.VERCEL_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    undefined;

  const allItems = sections.flatMap((s) => s.items);
  const primary = allItems[0];
  const subject =
    locale === "he"
      ? `תזכורת פיננסית: ${guideItemTitle(t, primary)}`
      : `Finance reminder: ${guideItemTitle(t, primary)}`;

  const rowsHtml = allItems
    .map((item) => {
      const href = appUrl ? `${appUrl}${item.href}` : item.href;
      return `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
          <div style="font-weight:600;margin-bottom:4px;">${escapeHtml(guideItemTitle(t, item))}</div>
          <div style="color:#6b7280;font-size:14px;margin-bottom:8px;">${escapeHtml(guideItemReason(t, item))}</div>
          <a href="${escapeHtml(href)}" style="color:#2563eb;font-size:14px;">${escapeHtml(t.guide_cta)}</a>
        </td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${rtl ? "rtl" : "ltr"}">
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f9fafb;padding:24px;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
    <tr><td>
      <h1 style="font-size:18px;margin:0 0 8px;">${escapeHtml(t.guide_bell_title)}</h1>
      <p style="color:#6b7280;font-size:14px;margin:0 0 16px;">${escapeHtml(
        locale === "he"
          ? "כמה צעדים ישאירו אותך על המסלול."
          : "A few steps will keep you on track."
      )}</p>
      <table width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    subject,
    html,
    stateIds: sections.map((s) => s.stateId),
  };
}

export async function persistGuideEmailState(
  uid: string,
  stateIds: string[],
  ignoreState: boolean
): Promise<void> {
  if (ignoreState) return;
  await Promise.all(stateIds.map((id) => saveGuideAlertState(uid, id)));
}
