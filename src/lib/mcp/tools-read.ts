import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { buildCategoryBudgetRows, computeExpenseByCategory, computeIncomeByCategory } from "@/lib/budget";
import { daysUntilDue, projectionMonthKey } from "@/lib/debt-due";
import { effectiveAnnualRate } from "@/lib/prime";
import { runSnowball, sortDebtsByPayoffOrder, toSnowballDebtInput } from "@/lib/snowball";
import {
  loadBooks,
  loadCategories,
  loadDebtPlan,
  loadDebts,
  loadLimits,
  loadMonthTransactions,
  loadRecurring,
  loadTags,
  loadTasks,
  loadUserSettings,
  resolveBookId,
} from "@/lib/server/finance-data";
import { getMonthKey, getMonthRange, normalizemerchant } from "@/lib/utils";
import { ToolError, getCaller, runTool } from "./context";
import { categoryNameMap, formatDay, round2, serializeTransaction, tagNameMap } from "./format";

export const MAX_TRANSACTION_ROWS = 200;
const MAX_RANGE_DAYS = 400;
const DAY_MS = 86_400_000;

/** Ids become Firestore path segments, so a "/" must never get through. */
export const idField = z.string().regex(/^[^/\s]{1,200}$/, "Invalid id");

export const bookIdField = idField
  .optional()
  .describe("Book id from list_books. Omit to use the user's default book.");
const monthField = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .describe("Calendar month as YYYY-MM. Defaults to the current month.");
const dayField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

function rangeFor(month?: string, from?: string, to?: string): { start: Date; end: Date } {
  if (from || to) {
    if (!from || !to) throw new ToolError("Provide both from and to, or use month.");
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T23:59:59.999`);
    if (end < start) throw new ToolError("to must be on or after from.");
    if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * DAY_MS) {
      throw new ToolError(`Date range is limited to ${MAX_RANGE_DAYS} days.`);
    }
    return { start, end };
  }
  return getMonthRange(month ?? getMonthKey(new Date()));
}

export function registerReadTools(server: McpServer): void {
  server.registerTool(
    "list_books",
    {
      title: "List books",
      description:
        "List the user's finance books (separate ledgers, e.g. personal vs business) with currency. Other tools default to the default book.",
      inputSchema: z.object({}),
      annotations: READ_ONLY,
    },
    async (_args, ctx) =>
      runTool(async () => {
        const { uid } = getCaller(ctx, "read");
        const [books, settings] = await Promise.all([loadBooks(uid), loadUserSettings(uid)]);
        return {
          books: books.map((b) => ({
            id: b.id,
            name: b.name,
            currency: b.currency,
            isDefault: b.id === settings?.defaultBookId,
          })),
        };
      })
  );

  server.registerTool(
    "list_categories",
    {
      title: "List categories",
      description: "List income and expense categories in a book, with their ids.",
      inputSchema: z.object({
        bookId: bookIdField,
        type: z.enum(["income", "expense"]).optional(),
      }),
      annotations: READ_ONLY,
    },
    async ({ bookId, type }, ctx) =>
      runTool(async () => {
        const { uid } = getCaller(ctx, "read");
        const book = await resolveBookId(uid, bookId);
        const categories = await loadCategories(uid, book);
        return {
          bookId: book,
          categories: categories
            .filter((c) => !type || c.type === type)
            .map((c) => ({ id: c.id, name: c.name, nameEn: c.nameEn ?? null, type: c.type })),
        };
      })
  );

  server.registerTool(
    "search_transactions",
    {
      title: "Search transactions",
      description: `Find transactions by month or date range, with optional filters. Returns totals for all matches and up to ${MAX_TRANSACTION_ROWS} rows (newest first).`,
      inputSchema: z.object({
        bookId: bookIdField,
        month: monthField.optional(),
        from: dayField.optional().describe("Start date YYYY-MM-DD (use with to instead of month)."),
        to: dayField.optional().describe("End date YYYY-MM-DD, inclusive."),
        type: z.enum(["income", "expense"]).optional(),
        categoryId: idField.optional(),
        merchant: z.string().optional().describe("Case-insensitive text to match in merchant name or note."),
        tag: z.string().optional().describe("Tag name or id."),
        limit: z.number().int().min(1).max(MAX_TRANSACTION_ROWS).optional().describe("Rows to return (default 50)."),
      }),
      annotations: READ_ONLY,
    },
    async (args, ctx) =>
      runTool(async () => {
        const { uid } = getCaller(ctx, "read");
        const book = await resolveBookId(uid, args.bookId);
        const { start, end } = rangeFor(args.month, args.from, args.to);
        const [txs, categories, tags] = await Promise.all([
          loadMonthTransactions(uid, book, start, end),
          loadCategories(uid, book),
          loadTags(uid, book),
        ]);
        const catNames = categoryNameMap(categories);
        const tagNames = tagNameMap(tags);

        const needle = args.merchant?.trim().toLowerCase();
        const needleNormalized = args.merchant ? normalizemerchant(args.merchant) : "";
        const tagId = args.tag
          ? (tags.find((t) => t.id === args.tag || t.name.toLowerCase() === args.tag!.toLowerCase())?.id ?? args.tag)
          : null;

        const matched = txs.filter((tx) => {
          if (args.type && tx.type !== args.type) return false;
          if (
            args.categoryId &&
            tx.categoryId !== args.categoryId &&
            !tx.splits?.some((s) => s.categoryId === args.categoryId)
          ) {
            return false;
          }
          if (tagId && !(tx.tags ?? []).includes(tagId)) return false;
          if (needle) {
            const hay = `${tx.merchantDisplay ?? ""} ${tx.note ?? ""}`.toLowerCase();
            const normalizedHit =
              needleNormalized && (tx.merchantNormalized ?? "").includes(needleNormalized);
            if (!hay.includes(needle) && !normalizedHit) return false;
          }
          return true;
        });

        let income = 0;
        let expense = 0;
        for (const tx of matched) {
          if (tx.type === "income") income += tx.amount;
          else expense += tx.amount;
        }
        const limit = args.limit ?? 50;

        return {
          bookId: book,
          from: formatDay(start),
          to: formatDay(end),
          matched: matched.length,
          totals: { income: round2(income), expense: round2(expense), net: round2(income - expense) },
          truncated: matched.length > limit,
          transactions: matched.slice(0, limit).map((tx) => serializeTransaction(tx, catNames, tagNames)),
        };
      })
  );

  server.registerTool(
    "month_summary",
    {
      title: "Month summary",
      description:
        "Income, expenses and net for a month, spending and income by category, and budget vs actual for every budgeted expense category.",
      inputSchema: z.object({ bookId: bookIdField, month: monthField.optional() }),
      annotations: READ_ONLY,
    },
    async ({ bookId, month }, ctx) =>
      runTool(async () => {
        const { uid } = getCaller(ctx, "read");
        const book = await resolveBookId(uid, bookId);
        const monthKey = month ?? getMonthKey(new Date());
        const { start, end } = getMonthRange(monthKey);
        const [txs, categories] = await Promise.all([
          loadMonthTransactions(uid, book, start, end),
          loadCategories(uid, book),
        ]);
        const limits = await loadLimits(uid, book, monthKey, categories);
        const catNames = categoryNameMap(categories);

        const expenseByCat = computeExpenseByCategory(txs);
        const incomeByCat = computeIncomeByCategory(txs);
        const budgetRows = buildCategoryBudgetRows(categories, limits, expenseByCat);
        const budgeted = new Set(budgetRows.map((r) => r.catId));

        const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
        const expense = txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
        const sortedEntries = (m: Record<string, number>) =>
          Object.entries(m)
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([catId, amount]) => ({ categoryId: catId, category: catNames.get(catId) ?? null, amount: round2(amount) }));

        return {
          bookId: book,
          month: monthKey,
          transactionCount: txs.length,
          income: round2(income),
          expense: round2(expense),
          net: round2(income - expense),
          expenseByCategory: sortedEntries(expenseByCat),
          incomeByCategory: sortedEntries(incomeByCat),
          budget: budgetRows
            .sort((a, b) => b.pct - a.pct)
            .map((r) => ({
              categoryId: r.catId,
              category: catNames.get(r.catId) ?? r.name,
              spent: round2(r.spent),
              limit: round2(r.limit),
              remaining: round2(r.limit - r.spent),
              percentUsed: Math.round(r.pct),
            })),
          unbudgetedSpending: sortedEntries(
            Object.fromEntries(Object.entries(expenseByCat).filter(([id]) => !budgeted.has(id)))
          ),
        };
      })
  );

  server.registerTool(
    "list_recurring",
    {
      title: "List recurring items",
      description: "List recurring income and expenses (subscriptions, salary, loan payments) with cadence and next date.",
      inputSchema: z.object({
        bookId: bookIdField,
        includeInactive: z.boolean().optional(),
      }),
      annotations: READ_ONLY,
    },
    async ({ bookId, includeInactive }, ctx) =>
      runTool(async () => {
        const { uid } = getCaller(ctx, "read");
        const book = await resolveBookId(uid, bookId);
        const [items, categories] = await Promise.all([loadRecurring(uid, book), loadCategories(uid, book)]);
        const catNames = categoryNameMap(categories);
        const rows = items
          .filter((r) => includeInactive || r.active)
          .map((r) => ({
            id: r.id,
            type: r.type,
            amount: round2(r.amount),
            cadence: r.cadence,
            dayOfMonth: r.dayOfMonth ?? null,
            nextRunDate: formatDay(r.nextRunDate),
            categoryId: r.categoryId,
            category: catNames.get(r.categoryId) ?? null,
            merchant: r.merchantDisplay ?? null,
            note: r.note ?? null,
            active: r.active,
          }));
        const monthlyEquivalent = (amount: number, cadence: string) =>
          cadence === "weekly" ? (amount * 52) / 12 : cadence === "yearly" ? amount / 12 : amount;
        const active = rows.filter((r) => r.active);
        return {
          bookId: book,
          monthlyIncome: round2(active.filter((r) => r.type === "income").reduce((s, r) => s + monthlyEquivalent(r.amount, r.cadence), 0)),
          monthlyExpense: round2(active.filter((r) => r.type === "expense").reduce((s, r) => s + monthlyEquivalent(r.amount, r.cadence), 0)),
          items: rows,
        };
      })
  );

  server.registerTool(
    "list_debts",
    {
      title: "List debts and payoff plan",
      description:
        "Open debts in pay-off order (balance, monthly payment, effective interest, due date) plus the snowball payoff projection from the user's saved plan.",
      inputSchema: z.object({
        bookId: bookIdField,
        includePaid: z.boolean().optional(),
      }),
      annotations: READ_ONLY,
    },
    async ({ bookId, includePaid }, ctx) =>
      runTool(async () => {
        const { uid } = getCaller(ctx, "read");
        const book = await resolveBookId(uid, bookId);
        const [debts, plan] = await Promise.all([loadDebts(uid, book), loadDebtPlan(uid, book)]);
        const open = sortDebtsByPayoffOrder(debts.filter((d) => d.status === "open"));

        const projection = plan
          ? runSnowball(
              open.map(toSnowballDebtInput).filter((d): d is NonNullable<typeof d> => d !== null),
              plan
            )
          : null;
        const closes = (id: string) => {
          const m = projection?.debtPayoffMonth[id];
          return m ? projectionMonthKey(m) : null;
        };

        const describe = (d: (typeof debts)[number], position: number | null) => ({
          id: d.id,
          payoffPosition: position,
          name: d.name,
          status: d.status,
          balance: round2(d.balance),
          monthlyPayment: round2(d.monthlyPayment),
          annualInterestPercent: effectiveAnnualRate(d),
          interestType: d.interestType,
          payFirst: d.forcePhase1,
          dueDate: d.dueDate ?? null,
          daysUntilDue: d.dueDate ? daysUntilDue(d.dueDate) : null,
          projectedPayoffMonth: d.status === "open" ? closes(d.id) : null,
          note: d.note ?? null,
        });

        return {
          bookId: book,
          totals: {
            openDebts: open.length,
            balance: round2(open.reduce((s, d) => s + d.balance, 0)),
            monthlyPayments: round2(open.reduce((s, d) => s + d.monthlyPayment, 0)),
          },
          debts: [
            ...open.map((d, i) => describe(d, i + 1)),
            ...(includePaid ? debts.filter((d) => d.status !== "open").map((d) => describe(d, null)) : []),
          ],
          plan: projection
            ? {
                monthlySurplus: plan!.nominalMonthlyIncome > 0 ? plan!.nominalMonthlyIncome : plan!.monthlyExtra,
                emergencyFundTarget: round2(projection.emergencyFundTarget),
                debtFreeMonth:
                  projection.totalMonths !== null ? projectionMonthKey(projection.totalMonths) : null,
                totalMonths: projection.totalMonths,
                totalInterest: round2(projection.totalInterest),
                stuck: projection.stuck,
                stuckReason: projection.stuckReason ?? null,
              }
            : null,
        };
      })
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description: "List money-saving tasks (e.g. cancel a subscription) with due date, status and linked transaction ids.",
      inputSchema: z.object({
        bookId: bookIdField,
        status: z.enum(["open", "done"]).optional(),
      }),
      annotations: READ_ONLY,
    },
    async ({ bookId, status }, ctx) =>
      runTool(async () => {
        const { uid } = getCaller(ctx, "read");
        const book = await resolveBookId(uid, bookId);
        const tasks = await loadTasks(uid, book);
        return {
          bookId: book,
          tasks: tasks
            .filter((t) => !status || t.status === status)
            .sort((a, b) => (a.endDate?.toMillis?.() ?? 0) - (b.endDate?.toMillis?.() ?? 0))
            .map((t) => ({
              id: t.id,
              title: t.title,
              note: t.note ?? null,
              endDate: formatDay(t.endDate),
              status: t.status,
              costFrequency: t.costFrequency,
              linkedTransactionIds: t.transactionIds ?? [],
            })),
        };
      })
  );
}
