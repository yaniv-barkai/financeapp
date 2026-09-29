import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  addTaskAdmin,
  addTransactionAdmin,
  loadCategories,
  loadMerchant,
  loadTags,
  loadTask,
  loadTransaction,
  resolveBookId,
  updateTaskAdmin,
  updateTransactionAdmin,
  upsertMerchantAdmin,
} from "@/lib/server/finance-data";
import { Category, Tag, TransactionType } from "@/lib/types";
import { normalizemerchant } from "@/lib/utils";
import { ToolError, getCaller, runTool } from "./context";
import { bookIdField, idField } from "./tools-read";

const dayField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

function todayInIsrael(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

/** Noon keeps the calendar day stable across time zones, matching the transaction form. */
function dayAtNoon(day: string): Date {
  return new Date(`${day}T12:00:00`);
}

function requireCategory(categories: Category[], categoryId: string, type?: TransactionType): Category {
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) throw new ToolError(`Unknown categoryId "${categoryId}". Call list_categories first.`);
  if (type && cat.type !== type) {
    throw new ToolError(`Category "${cat.name}" is an ${cat.type} category, not ${type}.`);
  }
  return cat;
}

function resolveTagIds(tags: Tag[], requested: string[]): string[] {
  return requested.map((value) => {
    const tag =
      tags.find((t) => t.id === value) ??
      tags.find((t) => t.name.toLowerCase() === value.trim().toLowerCase());
    if (!tag) {
      const known = tags.map((t) => t.name).join(", ") || "none";
      throw new ToolError(`Unknown tag "${value}". Existing tags: ${known}.`);
    }
    return tag.id;
  });
}

export function registerWriteTools(server: McpServer): void {
  server.registerTool(
    "add_transaction",
    {
      title: "Add transaction",
      description:
        "Record a new income or expense. If categoryId is omitted, the category remembered for the merchant is used. Requires a Read + Write token.",
      inputSchema: z.object({
        bookId: bookIdField,
        type: z.enum(["income", "expense"]),
        amount: z.number().positive().describe("Positive amount in the book's currency."),
        date: dayField.optional().describe("YYYY-MM-DD. Defaults to today."),
        categoryId: idField.optional(),
        merchant: z.string().max(120).optional(),
        note: z.string().max(500).optional(),
        tags: z.array(z.string()).max(10).optional().describe("Existing tag names or ids."),
      }),
      annotations: { ...WRITE, idempotentHint: false },
    },
    async (args, ctx) =>
      runTool(async () => {
        const { uid } = getCaller(ctx, "write");
        const book = await resolveBookId(uid, args.bookId);
        const [categories, tags] = await Promise.all([loadCategories(uid, book), loadTags(uid, book)]);

        const merchant = args.merchant?.trim() || undefined;
        const normalized = merchant ? normalizemerchant(merchant) : "";
        let categoryId = args.categoryId;
        if (!categoryId && normalized) {
          categoryId = (await loadMerchant(uid, book, normalized))?.defaultCategoryId;
        }
        if (!categoryId) {
          throw new ToolError("categoryId is required (no remembered category for this merchant). Call list_categories.");
        }
        const category = requireCategory(categories, categoryId, args.type);
        const tagIds = resolveTagIds(tags, args.tags ?? []);
        const date = args.date ?? todayInIsrael();

        const id = await addTransactionAdmin(uid, book, {
          type: args.type,
          amount: args.amount,
          categoryId,
          merchantDisplay: merchant,
          merchantNormalized: normalized || undefined,
          date: dayAtNoon(date),
          note: args.note?.trim() || undefined,
          tags: tagIds,
          source: "manual",
        });
        if (merchant && normalized) {
          await upsertMerchantAdmin(uid, book, normalized, merchant, categoryId);
        }

        return {
          ok: true,
          bookId: book,
          transaction: { id, date, type: args.type, amount: args.amount, category: category.name, merchant: merchant ?? null },
        };
      })
  );

  server.registerTool(
    "update_transaction",
    {
      title: "Update transaction",
      description:
        "Change the category, note or tags of an existing transaction. Changing the category also updates the merchant's remembered category. Requires a Read + Write token.",
      inputSchema: z.object({
        bookId: bookIdField,
        transactionId: idField,
        categoryId: idField.optional(),
        note: z.string().max(500).optional().describe("New note; empty string clears it."),
        tags: z.array(z.string()).max(10).optional().describe("Replaces all tags. Existing tag names or ids."),
      }),
      annotations: { ...WRITE, idempotentHint: true },
    },
    async (args, ctx) =>
      runTool(async () => {
        const { uid } = getCaller(ctx, "write");
        const book = await resolveBookId(uid, args.bookId);
        if (args.categoryId === undefined && args.note === undefined && args.tags === undefined) {
          throw new ToolError("Nothing to update: pass categoryId, note or tags.");
        }
        const tx = await loadTransaction(uid, book, args.transactionId);
        if (!tx) throw new ToolError(`Transaction not found: ${args.transactionId}`);

        const [categories, tags] = await Promise.all([loadCategories(uid, book), loadTags(uid, book)]);
        if (args.categoryId !== undefined) requireCategory(categories, args.categoryId, tx.type);
        const tagIds = args.tags ? resolveTagIds(tags, args.tags) : undefined;

        await updateTransactionAdmin(uid, book, tx.id, {
          categoryId: args.categoryId,
          note: args.note?.trim(),
          tags: tagIds,
        });

        const categoryChanged = args.categoryId !== undefined && args.categoryId !== tx.categoryId;
        if (categoryChanged && tx.merchantDisplay) {
          const normalized = normalizemerchant(tx.merchantDisplay);
          await upsertMerchantAdmin(uid, book, normalized, tx.merchantDisplay, args.categoryId!);
        }

        return { ok: true, bookId: book, transactionId: tx.id, updated: Object.keys(args).filter((k) => k !== "bookId" && k !== "transactionId") };
      })
  );

  server.registerTool(
    "create_task",
    {
      title: "Create task",
      description:
        "Create a money-saving task (e.g. 'Cancel gym membership') with a due date, optionally linked to transactions it would save. Requires a Read + Write token.",
      inputSchema: z.object({
        bookId: bookIdField,
        title: z.string().min(1).max(120),
        endDate: dayField.describe("Due date YYYY-MM-DD."),
        note: z.string().max(500).optional(),
        costFrequency: z
          .enum(["once", "monthly", "yearly"])
          .optional()
          .describe("How often the linked cost recurs (default once)."),
        transactionIds: z.array(idField).max(20).optional(),
      }),
      annotations: { ...WRITE, idempotentHint: false },
    },
    async (args, ctx) =>
      runTool(async () => {
        const { uid } = getCaller(ctx, "write");
        const book = await resolveBookId(uid, args.bookId);
        const transactionIds = args.transactionIds ?? [];
        const found = await Promise.all(transactionIds.map((id) => loadTransaction(uid, book, id)));
        const missing = transactionIds.filter((_, i) => !found[i]);
        if (missing.length) throw new ToolError(`Transactions not found: ${missing.join(", ")}`);

        const id = await addTaskAdmin(uid, book, {
          title: args.title.trim(),
          note: args.note?.trim() || undefined,
          endDate: dayAtNoon(args.endDate),
          status: "open",
          transactionIds,
          costFrequency: args.costFrequency ?? "once",
        });
        return { ok: true, bookId: book, task: { id, title: args.title.trim(), endDate: args.endDate, status: "open" } };
      })
  );

  server.registerTool(
    "set_task_status",
    {
      title: "Set task status",
      description: "Mark a task as done or reopen it. Requires a Read + Write token.",
      inputSchema: z.object({
        bookId: bookIdField,
        taskId: idField,
        status: z.enum(["open", "done"]),
      }),
      annotations: { ...WRITE, idempotentHint: true },
    },
    async ({ bookId, taskId, status }, ctx) =>
      runTool(async () => {
        const { uid } = getCaller(ctx, "write");
        const book = await resolveBookId(uid, bookId);
        const task = await loadTask(uid, book, taskId);
        if (!task) throw new ToolError(`Task not found: ${taskId}`);
        await updateTaskAdmin(uid, book, taskId, { status });
        return { ok: true, bookId: book, taskId, title: task.title, status };
      })
  );
}
