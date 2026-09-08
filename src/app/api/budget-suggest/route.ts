import OpenAI from "openai";
import { NextRequest } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface CategoryInput {
  id: string;
  name: string;
  budget: number;
  spent: number;
  recurring: number;
  prevMonthSpent: number;
}

interface SuggestRequest {
  monthKey: string;
  currency?: string;
  locale?: string;
  monthlyIncome?: number;
  categories: CategoryInput[];
}

interface Suggestion {
  catId: string;
  name: string;
  currentBudget: number;
  suggestedBudget: number;
  /** Positive = add budget, negative = free up budget */
  delta: number;
  reason: string;
}

interface PlanRow {
  id: string;
  name: string;
  budget: number;
  spent: number;
  recurring: number;
  prevMonthSpent: number;
  hardFloor: number;
  softNeed: number;
  gap: number;
  surplus: number;
  suggested: number;
}

/** Cover every gap category from every surplus category (proportional). */
function computeFullReallocation(categories: CategoryInput[]): {
  rows: PlanRow[];
  toMove: number;
  totalGap: number;
  totalSurplus: number;
} {
  const rows: PlanRow[] = categories.map((c) => {
    // Ceil so fractional spend (e.g. 121.3) never rounds down to a budget
    // that still leaves the category over (121).
    const hardFloor = Math.ceil(Math.max(c.spent, c.recurring));
    // Soft need also looks at last month so we don't leave underfunded categories mid-month
    const softNeed = Math.max(hardFloor, Math.ceil(c.prevMonthSpent));
    return {
      id: c.id,
      name: c.name,
      budget: c.budget,
      spent: c.spent,
      recurring: c.recurring,
      prevMonthSpent: c.prevMonthSpent,
      hardFloor,
      softNeed,
      gap: Math.max(0, softNeed - c.budget),
      surplus: Math.max(0, c.budget - softNeed),
      suggested: c.budget,
    };
  });

  const totalGap = rows.reduce((s, r) => s + r.gap, 0);
  const totalSurplus = rows.reduce((s, r) => s + r.surplus, 0);
  const toMove = Math.min(totalGap, totalSurplus);

  if (toMove < 0.5) {
    // Still raise any under-floor budgets even when nothing to reallocate
    for (const r of rows) {
      r.suggested = Math.max(r.hardFloor, Math.round(r.suggested));
    }
    return { rows, toMove: 0, totalGap, totalSurplus };
  }

  for (const r of rows) {
    if (r.surplus > 0 && totalSurplus > 0) {
      r.suggested = r.budget - (r.surplus / totalSurplus) * toMove;
    } else if (r.gap > 0 && totalGap > 0) {
      r.suggested = r.budget + (r.gap / totalGap) * toMove;
    }
  }

  // Whole currency units; ceil-based hard floor already applied above
  for (const r of rows) {
    r.suggested = Math.max(r.hardFloor, Math.round(r.suggested));
  }

  // Keep total budgeted stable (fix rounding drift)
  const originalTotal = Math.round(rows.reduce((s, r) => s + r.budget, 0));
  let drift = rows.reduce((s, r) => s + r.suggested, 0) - originalTotal;

  if (drift > 0) {
    const donors = rows
      .filter((r) => r.suggested > r.hardFloor && r.suggested <= r.budget)
      .sort((a, b) => b.suggested - a.suggested);
    for (const donor of donors) {
      if (drift <= 0) break;
      const cut = Math.min(drift, donor.suggested - donor.hardFloor);
      donor.suggested -= cut;
      drift -= cut;
    }
  } else if (drift < 0) {
    const receivers = rows
      .filter((r) => r.gap > 0 || r.suggested > r.budget)
      .sort((a, b) => b.gap - a.gap);
    for (const receiver of receivers) {
      if (drift >= 0) break;
      const add = Math.abs(drift);
      receiver.suggested += add;
      drift += add;
    }
  }

  // Drift cuts must never leave a category below its ceil hard floor
  for (const r of rows) {
    r.suggested = Math.max(r.hardFloor, Math.round(r.suggested));
  }

  return { rows, toMove, totalGap, totalSurplus };
}

function fallbackReason(
  row: PlanRow,
  delta: number,
  locale: "en" | "he"
): string {
  if (delta > 0) {
    if (locale === "he") {
      if (row.spent > row.budget) return "כיסוי חריגה מהתקציב עד כה";
      if (row.recurring > row.budget) return "כיסוי הוצאות קבועות שלא מכוסות";
      return "התאמה לרמת ההוצאה בחודש הקודם";
    }
    if (row.spent > row.budget) return "Cover overspend so far this month";
    if (row.recurring > row.budget) return "Cover uncovered recurring costs";
    return "Align with last month's spending level";
  }
  if (locale === "he") return "שחרור תקציב עודף לכיסוי פערים בקטגוריות אחרות";
  return "Free unused budget to cover gaps in other categories";
}

function fallbackSummary(
  locale: "en" | "he",
  toMove: number,
  totalGap: number,
  totalSurplus: number,
  currency: string
): string {
  const fmt = (n: number) => `${Math.round(n)} ${currency}`;
  if (toMove <= 0) {
    return locale === "he"
      ? "אין פערים שדורשים העברה, או שאין עודף להעביר."
      : "No gaps to cover, or no surplus available to move.";
  }
  if (totalGap > totalSurplus) {
    return locale === "he"
      ? `הועבר כל העודף הזמין (${fmt(toMove)}) לפערים — עדיין חסר ${fmt(totalGap - totalSurplus)} לכיסוי מלא.`
      : `Moved all available surplus (${fmt(toMove)}) into gaps — still short ${fmt(totalGap - totalSurplus)} for full cover.`;
  }
  return locale === "he"
    ? `הועבר ${fmt(toMove)} מקטגוריות עם עודף לכל הקטגוריות עם פער.`
    : `Moved ${fmt(toMove)} from surplus categories into every category with a gap.`;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await verifyIdToken(token);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as SuggestRequest;
  const seenIds = new Set<string>();
  const categories = (body.categories ?? []).filter((c) => {
    if (!c?.id || seenIds.has(c.id)) return false;
    seenIds.add(c.id);
    return c.budget > 0 || c.spent > 0 || c.recurring > 0 || c.prevMonthSpent > 0;
  });
  if (!categories.length) {
    return Response.json({ summary: "", suggestions: [] });
  }

  const currency = body.currency ?? "ILS";
  const locale = body.locale === "he" ? "he" : "en";
  const { rows, toMove, totalGap, totalSurplus } = computeFullReallocation(categories);

  const suggestions: Suggestion[] = rows
    .map((r) => {
      const delta = Math.round((r.suggested - r.budget) * 100) / 100;
      if (Math.abs(delta) < 1) return null;
      return {
        catId: r.id,
        name: r.name,
        currentBudget: r.budget,
        suggestedBudget: r.suggested,
        delta,
        reason: fallbackReason(r, delta, locale),
      };
    })
    .filter((s): s is Suggestion => s !== null)
    .sort((a, b) => b.delta - a.delta);

  let summary = fallbackSummary(locale, toMove, totalGap, totalSurplus, currency);

  // AI only writes clearer summary + per-move reasons — numbers are already final
  if (suggestions.length > 0 && process.env.OPENAI_API_KEY) {
    try {
      const moveLines = suggestions
        .map(
          (s) =>
            `- id=${s.catId} name="${s.name}" ${s.currentBudget} → ${s.suggestedBudget} (delta=${s.delta})`
        )
        .join("\n");

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_BUDGET_MODEL ?? "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You explain a completed budget reallocation. Do NOT change any numbers. Write a short summary and one short reason per category. Respond in ${locale === "he" ? "Hebrew" : "English"}. Return ONLY JSON:
{"summary":"...","reasons":[{"catId":"...","reason":"..."}]}`,
          },
          {
            role: "user",
            content: `Currency: ${currency}
Moved total: ${Math.round(toMove)}
Total gap: ${Math.round(totalGap)}
Total surplus used: ${Math.round(Math.min(totalGap, totalSurplus))}

Moves (already computed — explain only):
${moveLines}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const raw = completion.choices[0].message.content ?? "{}";
      const parsed = JSON.parse(raw) as {
        summary?: string;
        reasons?: Array<{ catId?: string; reason?: string }>;
      };
      if (parsed.summary) summary = String(parsed.summary).slice(0, 500);
      const reasonById = new Map(
        (parsed.reasons ?? [])
          .filter((r) => r.catId && r.reason)
          .map((r) => [String(r.catId), String(r.reason).slice(0, 280)])
      );
      for (const s of suggestions) {
        const reason = reasonById.get(s.catId);
        if (reason) s.reason = reason;
      }
    } catch {
      // Keep deterministic fallback copy
    }
  }

  return Response.json({ summary, suggestions });
}
