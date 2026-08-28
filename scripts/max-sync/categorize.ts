import OpenAI from "openai";

const MODEL = process.env.OPENAI_CATEGORIZE_MODEL ?? "gpt-4o-mini";

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

export interface CategoryInput {
  id: string;
  name: string;
  nameEn?: string;
  icon?: string;
  type: string;
}

export async function categorizeMerchants(
  merchants: string[],
  categories: CategoryInput[],
  apiKey: string
): Promise<Record<string, string>> {
  if (!merchants.length || !categories.length) return {};

  const openai = new OpenAI({ apiKey });
  const categoryList = categories
    .map((c) => {
      const label = c.nameEn && c.nameEn !== c.name ? `${c.name} / ${c.nameEn}` : c.name;
      const icon = c.icon ? `${c.icon} ` : "";
      return `  • id="${c.id}"  ${icon}${label}  [${c.type}]`;
    })
    .join("\n");

  const merchantList = merchants.map((m, i) => `  ${i + 1}. "${m}"`).join("\n");
  const userMessage = `CATEGORIES:\n${categoryList}\n\nMERCHANTS TO CATEGORISE:\n${merchantList}`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  const raw = completion.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(raw) as Record<string, string>;
  const validIds = new Set(categories.map((c) => c.id));
  const matches: Record<string, string> = {};
  for (const [merchant, catId] of Object.entries(parsed)) {
    if (validIds.has(catId)) matches[merchant] = catId;
  }

  return matches;
}
