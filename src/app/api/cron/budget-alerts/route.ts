import { NextRequest } from "next/server";
import { runBudgetAlertsForAllConfiguredUsers } from "@/lib/server/budget-alerts";

export async function GET(req: NextRequest) {
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
    return Response.json({ ok: true, emailsSent: sent });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
