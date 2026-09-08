import { NextRequest } from "next/server";
import { runBudgetAlertsForAllConfiguredUsers } from "@/lib/server/budget-alerts";

export async function GET(req: NextRequest) {
  // #region agent log
  fetch("http://127.0.0.1:7319/ingest/3fe75c29-122c-4137-9135-f8c7230bc020", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "18ad6c" },
    body: JSON.stringify({
      sessionId: "18ad6c",
      runId: process.env.DEBUG_RUN_ID ?? "pre-fix",
      hypothesisId: "A,F",
      location: "budget-alerts/route.ts:GET:entry",
      message: "cron route entered",
      data: {
        hasCronSecret: Boolean(process.env.CRON_SECRET),
        hasResend: Boolean(process.env.RESEND_API_KEY),
        hasSaKey: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY),
        hasSaFile: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE),
        hasSyncUid: Boolean(process.env.SYNC_USER_UID),
        hasAuthHeader: Boolean(req.headers.get("authorization")),
        hasVercelCron: Boolean(req.headers.get("x-vercel-cron")),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const vercelCron = req.headers.get("x-vercel-cron");

  if (token !== cronSecret && !vercelCron) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sent = await runBudgetAlertsForAllConfiguredUsers();
    // #region agent log
    fetch("http://127.0.0.1:7319/ingest/3fe75c29-122c-4137-9135-f8c7230bc020", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "18ad6c" },
      body: JSON.stringify({
        sessionId: "18ad6c",
        runId: process.env.DEBUG_RUN_ID ?? "pre-fix",
        hypothesisId: "B",
        location: "budget-alerts/route.ts:GET:ok",
        message: "cron route completed",
        data: { emailsSent: sent },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return Response.json({ ok: true, emailsSent: sent });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // #region agent log
    fetch("http://127.0.0.1:7319/ingest/3fe75c29-122c-4137-9135-f8c7230bc020", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "18ad6c" },
      body: JSON.stringify({
        sessionId: "18ad6c",
        runId: process.env.DEBUG_RUN_ID ?? "pre-fix",
        hypothesisId: "A,F",
        location: "budget-alerts/route.ts:GET:catch",
        message: "cron route error",
        data: { error: message.slice(0, 400) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return Response.json({ error: message }, { status: 500 });
  }
}
