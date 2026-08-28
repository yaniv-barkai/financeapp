import OpenAI from "openai";
import { NextRequest } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface CategorizeRequest {
  merchants: string[];
  categories: Array<{ id: string; name: string; nameEn?: string; icon?: string; type: string }>;
}

export interface CategorizeResponse {
  matches: Record<string, string>; // merchant → categoryId
}

const SYSTEM = `You are an expert personal-finance categorization engine with deep knowledge of Israeli and international merchants, brands, and bank statement descriptions.

Your job: given a list of user-defined budget categories and a list of raw bank-statement merchant strings, assign each merchant to the single most appropriate category.

Rules:
1. Match by meaning, not spelling. Bank descriptions are often truncated, uppercase, transliterated Hebrew, or contain extra codes — look past that.
2. Israeli context: many merchants are Israeli businesses written in Hebrew or transliterated Latin. Use your knowledge of Israeli supermarkets (שופרסל, רמי לוי, מגה, יינות ביתן), fuel stations (פז, דלק, סונול), telecoms (בזק, הוט, סלקום, פרטנר), banks, insurance companies, government services, etc.
3. Common patterns to recognise:
   - "SUPER-PHARM", "SUPER PHARM", "סופר-פארם" → Pharmacy / Health
   - "SHUFERSAL", "שופרסל" → Groceries / Food
   - "PAZ", "DORAL", "SONOL", "DELEK" → Fuel / Transport
   - Payment processors like "BIT", "PAYBOX", "PEPPER" are often transfers — pick the best type-matching category
   - "ICOUNT", "MESHULAM", "TRANZILA" are business payment services
   - Government / municipality payments → Taxes / Bills
4. Category types matter: only match expense merchants to expense categories and income sources to income categories.
5. Be confident — if something is plausibly a match, assign it. Only omit a merchant if it is truly ambiguous AND no category is even remotely fitting.
6. Return ONLY a valid JSON object: { "merchant string exactly as given": "categoryId", ... }. No markdown, no explanation.`;

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

  const { merchants, categories } = (await req.json()) as CategorizeRequest;

  if (!merchants.length || !categories.length) {
    return Response.json({ matches: {} });
  }

  const categoryList = categories
    .map((c) => {
      const label = c.nameEn && c.nameEn !== c.name ? `${c.name} / ${c.nameEn}` : c.name;
      const icon = c.icon ? `${c.icon} ` : "";
      return `  • id="${c.id}"  ${icon}${label}  [${c.type}]`;
    })
    .join("\n");

  const merchantList = merchants
    .map((m, i) => `  ${i + 1}. "${m}"`)
    .join("\n");

  const userMessage = `CATEGORIES:\n${categoryList}\n\nMERCHANTS TO CATEGORISE:\n${merchantList}`;

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_CATEGORIZE_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  const raw = completion.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(raw) as Record<string, string>;

  // Validate every returned ID actually exists in the provided categories
  const validIds = new Set(categories.map((c) => c.id));
  const matches: Record<string, string> = {};
  for (const [merchant, catId] of Object.entries(parsed)) {
    if (validIds.has(catId)) matches[merchant] = catId;
  }

  return Response.json({ matches } satisfies CategorizeResponse);
}
