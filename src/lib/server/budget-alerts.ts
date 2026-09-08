import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  buildCategoryBudgetRows,
  computeExpenseByCategory,
  findNewThresholdCrossings,
} from "@/lib/budget";
import { Category, Transaction, UserSettings } from "@/lib/types";
import {
  daysUntilMonthEnd,
  getMonthKey,
  getMonthRange,
  getNextMonthKey,
  getPrevMonthKey,
} from "@/lib/utils";

const DEFAULT_THRESHOLDS = [80, 100];
const UNSET_BUDGET_ALERT_DAYS = 5;
const UNSET_BUDGET_STATE_ID = "unset_next_month";

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

/** Prefer this month's monthly budget, else previous month, else legacy limits. */
async function loadLimits(
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

async function isMonthlyBudgetSet(
  uid: string,
  bookId: string,
  monthKey: string
): Promise<boolean> {
  const amounts = await loadMonthlyBudgetAmounts(uid, bookId, monthKey);
  return amounts !== null;
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
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Finance Alert <onboarding@resend.dev>";
  // #region agent log
  fetch("http://127.0.0.1:7319/ingest/3fe75c29-122c-4137-9135-f8c7230bc020", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "18ad6c" },
    body: JSON.stringify({
      sessionId: "18ad6c",
      runId: process.env.DEBUG_RUN_ID ?? "pre-fix",
      hypothesisId: "A",
      location: "budget-alerts.ts:sendBudgetEmail",
      message: "resend send attempt",
      data: {
        hasApiKey: Boolean(apiKey),
        from,
        toDomain: to.includes("@") ? to.split("@")[1] : "invalid",
        subject,
        htmlLen: html.length,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
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
    // #region agent log
    fetch("http://127.0.0.1:7319/ingest/3fe75c29-122c-4137-9135-f8c7230bc020", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "18ad6c" },
      body: JSON.stringify({
        sessionId: "18ad6c",
        runId: process.env.DEBUG_RUN_ID ?? "pre-fix",
        hypothesisId: "A",
        location: "budget-alerts.ts:sendBudgetEmail:error",
        message: "resend send failed",
        data: { status: res.status, bodySlice: body.slice(0, 300) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
  // #region agent log
  fetch("http://127.0.0.1:7319/ingest/3fe75c29-122c-4137-9135-f8c7230bc020", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "18ad6c" },
    body: JSON.stringify({
      sessionId: "18ad6c",
      runId: process.env.DEBUG_RUN_ID ?? "pre-fix",
      hypothesisId: "A",
      location: "budget-alerts.ts:sendBudgetEmail:ok",
      message: "resend send ok",
      data: { status: res.status },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("he-IL", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function statusForPct(pct: number): { label: string; color: string; bg: string } {
  if (pct >= 100) return { label: "חריגה", color: "#991b1b", bg: "#fee2e2" };
  if (pct >= 80) return { label: "אזהרה", color: "#92400e", bg: "#fef3c7" };
  return { label: "תקין", color: "#166534", bg: "#dcfce7" };
}

/** Highest newly crossed threshold per category (for alertState). */
function highestNewThresholdByCategory(
  crossings: { catId: string; threshold: number }[]
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of crossings) {
    map[c.catId] = Math.max(map[c.catId] ?? 0, c.threshold);
  }
  return map;
}

function buildBudgetDigestHtml(opts: {
  monthKey: string;
  currency: string;
  rows: { catId: string; name: string; spent: number; limit: number; pct: number }[];
  newCrossingCatIds: Set<string>;
  appUrl?: string;
}): string {
  const { monthKey, currency, rows, newCrossingCatIds, appUrl } = opts;
  const monthLabel = formatMonthLabel(monthKey);
  const sorted = [...rows].sort((a, b) => b.pct - a.pct);

  const totalSpent = sorted.reduce((s, r) => s + r.spent, 0);
  const totalLimit = sorted.reduce((s, r) => s + r.limit, 0);
  const totalPct = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
  const over = sorted.filter((r) => r.pct >= 100);
  const warning = sorted.filter((r) => r.pct >= 80 && r.pct < 100);
  const ok = sorted.filter((r) => r.pct < 80);

  const bar = (pct: number, color: string) => {
    const width = Math.min(100, Math.max(0, Math.round(pct)));
    return `<td style="padding:8px 12px;min-width:120px;" dir="ltr">
      <div style="background:#e5e7eb;border-radius:4px;height:8px;overflow:hidden;direction:ltr;">
        <div style="background:${color};height:8px;width:${width}%;"></div>
      </div>
    </td>`;
  };

  const rowHtml = (r: (typeof sorted)[0], highlight: boolean) => {
    const st = statusForPct(r.pct);
    const barColor = r.pct >= 100 ? "#ef4444" : r.pct >= 80 ? "#f59e0b" : "#22c55e";
    const remaining = r.limit - r.spent;
    const remainingLabel =
      remaining >= 0
        ? `נותר ${formatMoney(remaining, currency)}`
        : `חריגה ${formatMoney(-remaining, currency)}`;
    const bg = highlight ? "#fff7ed" : "#ffffff";
    const badge = highlight
      ? `<span style="display:inline-block;margin-right:6px;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:600;background:#fed7aa;color:#9a3412;">חדש</span>`
      : "";
    return `<tr style="background:${bg};border-bottom:1px solid #e5e7eb;">
      <td style="padding:10px 12px;font-size:14px;color:#111827;text-align:right;">
        ${badge}${escapeHtml(r.name)}
      </td>
      <td style="padding:10px 12px;font-size:14px;text-align:left;color:#111827;white-space:nowrap;" dir="ltr">
        ${formatMoney(r.spent, currency)}
      </td>
      <td style="padding:10px 12px;font-size:14px;text-align:left;color:#6b7280;white-space:nowrap;" dir="ltr">
        ${formatMoney(r.limit, currency)}
      </td>
      <td style="padding:10px 12px;font-size:14px;text-align:left;font-weight:600;color:${st.color};white-space:nowrap;" dir="ltr">
        ${Math.round(r.pct)}%
      </td>
      ${bar(r.pct, barColor)}
      <td style="padding:10px 12px;font-size:12px;text-align:right;color:#6b7280;white-space:nowrap;">
        ${remainingLabel}
      </td>
      <td style="padding:10px 12px;text-align:center;">
        <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:${st.bg};color:${st.color};">${st.label}</span>
      </td>
    </tr>`;
  };

  const th = (label: string, align: "right" | "left" | "center" = "right") =>
    `<th align="${align}" style="padding:8px 12px;font-size:11px;color:#6b7280;text-align:${align};">${label}</th>`;

  const section = (
    title: string,
    subtitle: string,
    items: typeof sorted,
    empty: string
  ) => {
    if (!items.length) {
      return `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;text-align:right;">${escapeHtml(empty)}</p>`;
    }
    return `
      <h3 style="margin:24px 0 4px;font-size:15px;color:#111827;text-align:right;">${escapeHtml(title)}</h3>
      <p style="margin:0 0 10px;font-size:13px;color:#6b7280;text-align:right;">${escapeHtml(subtitle)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;" dir="rtl">
        <thead>
          <tr style="background:#f9fafb;">
            ${th("קטגוריה", "right")}
            ${th("הוצאה", "left")}
            ${th("תקציב", "left")}
            ${th("%", "left")}
            ${th("התקדמות", "right")}
            ${th("יתרה", "right")}
            ${th("סטטוס", "center")}
          </tr>
        </thead>
        <tbody>
          ${items.map((r) => rowHtml(r, newCrossingCatIds.has(r.catId))).join("")}
        </tbody>
      </table>`;
  };

  const cta = appUrl
    ? `<p style="margin:28px 0 0;text-align:center;">
        <a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:10px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">פתח את האפליקציה</a>
      </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<body dir="rtl" style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'Noto Sans Hebrew',sans-serif;direction:rtl;text-align:right;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="background:#f3f4f6;padding:24px 12px;direction:rtl;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="max-width:720px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;direction:rtl;text-align:right;">
          <tr>
            <td style="padding:24px 28px;background:#111827;color:#ffffff;text-align:right;">
              <div style="font-size:12px;letter-spacing:0.08em;opacity:0.7;">דוח תקציב</div>
              <div style="font-size:22px;font-weight:700;margin-top:4px;">${escapeHtml(monthLabel)}</div>
              <div style="font-size:13px;margin-top:6px;opacity:0.8;">התראות חדשות · סקירת החודש</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;text-align:right;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="margin-bottom:8px;direction:rtl;">
                <tr>
                  <td style="padding:12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;width:25%;text-align:right;">
                    <div style="font-size:11px;color:#6b7280;">הוצאה</div>
                    <div style="font-size:16px;font-weight:700;color:#111827;margin-top:4px;" dir="ltr">${formatMoney(totalSpent, currency)}</div>
                  </td>
                  <td width="8"></td>
                  <td style="padding:12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;width:25%;text-align:right;">
                    <div style="font-size:11px;color:#6b7280;">תקציב</div>
                    <div style="font-size:16px;font-weight:700;color:#111827;margin-top:4px;" dir="ltr">${formatMoney(totalLimit, currency)}</div>
                  </td>
                  <td width="8"></td>
                  <td style="padding:12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;width:25%;text-align:right;">
                    <div style="font-size:11px;color:#6b7280;">סה״כ</div>
                    <div style="font-size:16px;font-weight:700;color:${statusForPct(totalPct).color};margin-top:4px;" dir="ltr">${Math.round(totalPct)}%</div>
                  </td>
                  <td width="8"></td>
                  <td style="padding:12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;width:25%;text-align:right;">
                    <div style="font-size:11px;color:#6b7280;">התראות</div>
                    <div style="font-size:16px;font-weight:700;color:#111827;margin-top:4px;">${over.length} חריגה · ${warning.length} אזהרה</div>
                  </td>
                </tr>
              </table>

              ${section(
                `מעבר לתקציב (${over.length})`,
                "קטגוריות ב־100% ומעלה מהתקציב החודשי.",
                over,
                "אין קטגוריות מעבר לתקציב."
              )}
              ${section(
                `אזהרה 80–99% (${warning.length})`,
                "קטגוריות שמתקרבות לתקציב החודשי.",
                warning,
                "אין קטגוריות בטווח האזהרה."
              )}
              ${section(
                `במסלול (${ok.length})`,
                "שאר הקטגוריות עם תקציב חודשי.",
                ok,
                "אין קטגוריות נוספות עם תקציב."
              )}

              ${cta}
              <p style="margin:20px 0 0;font-size:11px;color:#9ca3af;text-align:center;">
                קטגוריות מסומנות ב־״חדש״ חצו סף התראה מאז המייל הקודם.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildUnsetBudgetHtml(opts: {
  nextMonthKey: string;
  daysLeft: number;
  appUrl?: string;
}): string {
  const { nextMonthKey, daysLeft, appUrl } = opts;
  const nextLabel = formatMonthLabel(nextMonthKey);
  const cta = appUrl
    ? `<p style="margin:28px 0 0;text-align:center;">
        <a href="${escapeHtml(appUrl)}/categories" style="display:inline-block;padding:10px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">הגדר תקציב לחודש הבא</a>
      </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<body dir="rtl" style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'Noto Sans Hebrew',sans-serif;direction:rtl;text-align:right;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="background:#f3f4f6;padding:24px 12px;direction:rtl;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;direction:rtl;text-align:right;">
          <tr>
            <td style="padding:24px 28px;background:#111827;color:#ffffff;text-align:right;">
              <div style="font-size:12px;letter-spacing:0.08em;opacity:0.7;">תזכורת תקציב</div>
              <div style="font-size:22px;font-weight:700;margin-top:4px;">${escapeHtml(nextLabel)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;text-align:right;">
              <p style="margin:0;font-size:15px;color:#111827;line-height:1.6;">
                נותרו ${daysLeft} ימים עד סוף החודש, ועדיין לא הוגדר תקציב לחודש <strong>${escapeHtml(nextLabel)}</strong>.
              </p>
              <p style="margin:12px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
                הגדרת תקציב חודשי עוזרת לעקוב אחרי הוצאות ולתכנן לפי תשלומים קבועים.
              </p>
              ${cta}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function runBudgetAlertsForUser(uid: string): Promise<number> {
  const userSnap = await getAdminFirestore().doc(`users/${uid}`).get();
  if (!userSnap.exists) {
    // #region agent log
    fetch("http://127.0.0.1:7319/ingest/3fe75c29-122c-4137-9135-f8c7230bc020", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "18ad6c" },
      body: JSON.stringify({
        sessionId: "18ad6c",
        runId: process.env.DEBUG_RUN_ID ?? "pre-fix",
        hypothesisId: "D",
        location: "budget-alerts.ts:runBudgetAlertsForUser",
        message: "user doc missing",
        data: { uid },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return 0;
  }

  const settings = userSnap.data() as UserSettings;
  const alertSettings = settings.alertSettings;
  if (alertSettings?.emailEnabled === false) {
    // #region agent log
    fetch("http://127.0.0.1:7319/ingest/3fe75c29-122c-4137-9135-f8c7230bc020", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "18ad6c" },
      body: JSON.stringify({
        sessionId: "18ad6c",
        runId: process.env.DEBUG_RUN_ID ?? "pre-fix",
        hypothesisId: "D",
        location: "budget-alerts.ts:runBudgetAlertsForUser",
        message: "email alerts disabled",
        data: { uid },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return 0;
  }

  const thresholds = alertSettings?.thresholds?.length
    ? alertSettings.thresholds
    : DEFAULT_THRESHOLDS;

  const bookId = settings.maxSync?.bookId ?? settings.defaultBookId;
  if (!bookId) {
    // #region agent log
    fetch("http://127.0.0.1:7319/ingest/3fe75c29-122c-4137-9135-f8c7230bc020", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "18ad6c" },
      body: JSON.stringify({
        sessionId: "18ad6c",
        runId: process.env.DEBUG_RUN_ID ?? "pre-fix",
        hypothesisId: "C",
        location: "budget-alerts.ts:runBudgetAlertsForUser",
        message: "no bookId",
        data: { uid, hasMaxSync: Boolean(settings.maxSync), defaultBookId: settings.defaultBookId ?? null },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return 0;
  }

  const monthKey = getMonthKey(new Date());
  const { start, end } = getMonthRange(monthKey);
  const currency = settings.currency ?? "ILS";
  const nextMonthKey = getNextMonthKey(monthKey);

  const categories = await loadCategories(uid, bookId);
  const [limits, transactions, alreadySentRaw] = await Promise.all([
    loadLimits(uid, bookId, monthKey, categories),
    loadMonthTransactions(uid, bookId, start, end),
    loadAlertState(uid, monthKey),
  ]);

  const ignoreState = process.env.BUDGET_ALERTS_IGNORE_STATE === "1";
  const alreadySent = ignoreState ? {} : alreadySentRaw;

  const auth = await import("firebase-admin/auth").then((m) => m.getAuth());
  const userRecord = await auth.getUser(uid);
  const to =
    process.env.BUDGET_ALERTS_TO?.trim() ||
    alertSettings?.alertEmail ||
    userRecord.email;

  let emailsSent = 0;

  // Reminder: next month budget not set (within last 5 days of month)
  const daysLeft = daysUntilMonthEnd(new Date());
  if (to && daysLeft <= UNSET_BUDGET_ALERT_DAYS) {
    const nextSet = await isMonthlyBudgetSet(uid, bookId, nextMonthKey);
    const unsetStateId = `${monthKey}_${UNSET_BUDGET_STATE_ID}`;
    const unsetAlreadySent = ignoreState
      ? false
      : (
          await getAdminFirestore().doc(`users/${uid}/alertState/${unsetStateId}`).get()
        ).exists;

    if (!nextSet && !unsetAlreadySent) {
      const appUrl =
        process.env.VERCEL_APP_URL?.replace(/\/$/, "") ||
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
        undefined;
      const nextLabel = formatMonthLabel(nextMonthKey);
      const subject = `תזכורת: תקציב ל־${nextLabel} עדיין לא הוגדר`;
      const html = buildUnsetBudgetHtml({
        nextMonthKey,
        daysLeft,
        appUrl,
      });
      await sendBudgetEmail(to, subject, html);
      if (!ignoreState) {
        await getAdminFirestore()
          .doc(`users/${uid}/alertState/${unsetStateId}`)
          .set({ lastThresholdSent: 1, sentAt: Timestamp.now() });
      }
      emailsSent += 1;
    }
  }

  const expenseByCategory = computeExpenseByCategory(transactions);
  const rows = buildCategoryBudgetRows(categories, limits, expenseByCategory);
  const crossings = findNewThresholdCrossings(rows, thresholds, alreadySent);

  // #region agent log
  fetch("http://127.0.0.1:7319/ingest/3fe75c29-122c-4137-9135-f8c7230bc020", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "18ad6c" },
    body: JSON.stringify({
      sessionId: "18ad6c",
      runId: process.env.DEBUG_RUN_ID ?? "pre-fix",
      hypothesisId: "B,C,E",
      location: "budget-alerts.ts:runBudgetAlertsForUser:computed",
      message: "budget alert computation",
      data: {
        uid,
        bookId,
        monthKey,
        nextMonthKey,
        daysLeft,
        start: start.toISOString(),
        end: end.toISOString(),
        currency,
        thresholds,
        ignoreState,
        categoryCount: categories.length,
        limitCount: Object.keys(limits).length,
        txCount: transactions.length,
        alreadySent,
        rowsOver80: rows
          .filter((r) => r.pct >= 80)
          .map((r) => ({
            name: r.name,
            spent: r.spent,
            limit: r.limit,
            pct: Math.round(r.pct * 10) / 10,
          })),
        crossingCount: crossings.length,
        crossings: crossings.map((c) => ({
          name: c.categoryName,
          threshold: c.threshold,
          spent: c.spent,
          limit: c.limit,
          pct: Math.round(c.pct * 10) / 10,
        })),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  if (!crossings.length) return emailsSent;
  if (!to) return emailsSent;

  const newCrossingCatIds = new Set(crossings.map((c) => c.catId));
  const highestByCat = highestNewThresholdByCategory(crossings);
  const overCount = rows.filter((r) => r.pct >= 100).length;
  const warnCount = rows.filter((r) => r.pct >= 80 && r.pct < 100).length;

  const subject =
    overCount > 0
      ? `דוח תקציב: ${overCount} חריגה · ${warnCount} אזהרה (${formatMonthLabel(monthKey)})`
      : `דוח תקציב: ${warnCount} אזהרות (${formatMonthLabel(monthKey)})`;

  const appUrl =
    process.env.VERCEL_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    undefined;

  const html = buildBudgetDigestHtml({
    monthKey,
    currency,
    rows,
    newCrossingCatIds,
    appUrl,
  });

  // #region agent log
  fetch("http://127.0.0.1:7319/ingest/3fe75c29-122c-4137-9135-f8c7230bc020", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "18ad6c" },
    body: JSON.stringify({
      sessionId: "18ad6c",
      runId: process.env.DEBUG_RUN_ID ?? "pre-fix",
      hypothesisId: "E",
      location: "budget-alerts.ts:runBudgetAlertsForUser:digest",
      message: "sending digest email",
      data: {
        subject,
        rowCount: rows.length,
        newCrossingCats: newCrossingCatIds.size,
        overCount,
        warnCount,
        htmlLen: html.length,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  await sendBudgetEmail(to, subject, html);

  if (!ignoreState) {
    await Promise.all(
      Object.entries(highestByCat).map(([catId, threshold]) =>
        saveAlertState(uid, monthKey, catId, threshold)
      )
    );
  }

  return emailsSent + 1;
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
