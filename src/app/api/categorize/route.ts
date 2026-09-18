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
5. Be confident — assign every merchant to the best-fitting category. Prefer a generic "Other" / "אחר" / uncategorized-style expense category over omitting.
6. Return JSON with this exact shape:
   { "assignments": [ { "merchant": "<exact merchant string>", "categoryId": "<id from list>" }, ... ] }
   - "merchant" MUST be copied exactly from the input list (same characters).
   - "categoryId" MUST be the exact id value from the category list (the token after id=), NEVER the category name.
   - Include one assignment per merchant. No markdown, no explanation.`;

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

  const body = (await req.json()) as CategorizeRequest;
  const merchants = (body.merchants ?? []).map((m) => String(m ?? "").trim()).filter(Boolean);
  const categories = (body.categories ?? []).filter((c) => c && c.id && c.name);

  if (!merchants.length || !categories.length) {
    return Response.json(
      {
        matches: {},
        error: !categories.length ? "No categories provided" : "No merchants provided",
      },
      { status: 400 }
    );
  }

  const categoryList = categories
    .map((c) => {
      const label = c.nameEn && c.nameEn !== c.name ? `${c.name} / ${c.nameEn}` : c.name;
      const icon = c.icon ? `${c.icon} ` : "";
      return `  • id=${c.id}  ${icon}${label}  [${c.type}]`;
    })
    .join("\n");

  try {
    const model = process.env.OPENAI_CATEGORIZE_MODEL ?? "gpt-4o-mini";
    const CHUNK = 40;
    const mergedFlat: Record<string, string> = {};

    for (let i = 0; i < merchants.length; i += CHUNK) {
      const chunk = merchants.slice(i, i + CHUNK);
      const merchantList = chunk
        .map((m, idx) => `  ${idx + 1}. ${JSON.stringify(m)}`)
        .join("\n");
      const userMessage = `CATEGORIES:\n${categoryList}\n\nMERCHANTS TO CATEGORISE:\n${merchantList}`;

      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      });

      const raw = completion.choices[0].message.content ?? "{}";
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.error("categorize: invalid JSON from model", raw.slice(0, 500));
        return Response.json({ error: "Invalid AI response" }, { status: 502 });
      }

      Object.assign(mergedFlat, flattenCategorizeResponse(parsed));
    }

    const matches = resolveMatches(mergedFlat, merchants, categories);

    if (Object.keys(matches).length === 0) {
      console.warn(
        "categorize: 0 matches",
        `merchants=${merchants.length}`,
        `categories=${categories.length}`,
        `rawKeys=${Object.keys(mergedFlat).slice(0, 5).join("|")}`
      );
    }

    return Response.json({ matches } satisfies CategorizeResponse);
  } catch (err) {
    console.error("categorize failed:", err);
    return Response.json({ error: "Categorize request failed" }, { status: 500 });
  }
}

/** Models sometimes wrap as `{ matches: {...} }` or `{ assignments: [...] }`. */
function flattenCategorizeResponse(parsed: unknown): Record<string, string> {
  if (!parsed || typeof parsed !== "object") return {};

  const obj = parsed as Record<string, unknown>;
  const out: Record<string, string> = {};

  const takePair = (merchant: unknown, catId: unknown) => {
    if (typeof merchant === "string" && merchant.trim() && typeof catId === "string" && catId.trim()) {
      out[merchant] = catId.trim();
    }
  };

  const takeArray = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      takePair(
        row.merchant ?? row.name ?? row.description ?? row.merchantName,
        row.categoryId ?? row.category_id ?? row.category ?? row.id
      );
    }
  };

  takeArray(obj.assignments);
  takeArray(obj.categorizations);
  takeArray(obj.results);
  takeArray(obj.matches);
  takeArray(obj.data);

  const nestedObjects = [obj.matches, obj.results, obj.assignments, obj.data];
  for (const nested of nestedObjects) {
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      for (const [k, v] of Object.entries(nested as Record<string, unknown>)) {
        if (typeof v === "string") takePair(k, v);
        else if (v && typeof v === "object") {
          const row = v as Record<string, unknown>;
          takePair(
            row.merchant ?? row.name ?? k,
            row.categoryId ?? row.category_id ?? row.category ?? row.id
          );
        }
      }
    }
  }

  // Flat map: { "Merchant": "categoryId-or-name", ... }
  for (const [k, v] of Object.entries(obj)) {
    if (["assignments", "categorizations", "results", "matches", "data"].includes(k)) continue;
    if (typeof v === "string") takePair(k, v);
  }

  return out;
}

function resolveMatches(
  flat: Record<string, string>,
  merchants: string[],
  categories: CategorizeRequest["categories"]
): Record<string, string> {
  const merchantByNorm = new Map<string, string>();
  for (const m of merchants) {
    merchantByNorm.set(normalizeKey(m), m);
  }

  const catById = new Map(categories.map((c) => [c.id, c.id]));
  const catByName = new Map<string, string>();
  for (const c of categories) {
    catByName.set(normalizeKey(c.name), c.id);
    if (c.nameEn) catByName.set(normalizeKey(c.nameEn), c.id);
  }

  const matches: Record<string, string> = {};
  for (const [rawMerchant, rawCat] of Object.entries(flat)) {
    const merchant = resolveMerchantKey(rawMerchant, merchants, merchantByNorm);
    const catId = resolveCategoryId(rawCat, catById, catByName);
    if (merchant && catId) matches[merchant] = catId;
  }

  // Index-based fallback: { "1": "catId", "2": "catId" }
  for (const [rawMerchant, rawCat] of Object.entries(flat)) {
    const idx = Number(rawMerchant.trim());
    if (!Number.isInteger(idx) || idx < 1 || idx > merchants.length) continue;
    const catId = resolveCategoryId(rawCat, catById, catByName);
    if (catId) matches[merchants[idx - 1]] = catId;
  }

  return matches;
}

function normalizeKey(s: string): string {
  return s.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
}

function resolveMerchantKey(
  returned: string,
  merchants: string[],
  byNorm: Map<string, string>
): string | null {
  const trimmed = returned.normalize("NFC").trim();
  if (byNorm.has(normalizeKey(trimmed))) return byNorm.get(normalizeKey(trimmed))!;

  const contained = merchants.filter(
    (m) => m.includes(trimmed) || trimmed.includes(m.trim())
  );
  return contained.length === 1 ? contained[0] : null;
}

function resolveCategoryId(
  raw: string,
  byId: Map<string, string>,
  byName: Map<string, string>
): string | null {
  const trimmed = raw.trim().replace(/^id=/i, "").replace(/^["']|["']$/g, "");
  if (byId.has(trimmed)) return byId.get(trimmed)!;
  const byNameHit = byName.get(normalizeKey(trimmed));
  if (byNameHit) return byNameHit;
  // Model sometimes returns "Food (expense)" or "🛒 Food"
  for (const [name, id] of byName) {
    if (normalizeKey(trimmed).includes(name) || name.includes(normalizeKey(trimmed))) {
      return id;
    }
  }
  return null;
}
