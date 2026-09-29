import { Timestamp } from "firebase/firestore";
import { addMonths } from "date-fns";
import { Category, Debt, Recurring } from "./types";
import {
  addRecurring,
  deleteRecurring,
  updateRecurring,
} from "./firestore/recurring";
export { isPhase1Debt } from "./snowball";

const AUTO_DEBT_NOTE_PREFIX = "Auto from debt";

/** True for recurrings created by syncDebtRecurring (identified by their note). */
export function isAutoDebtRecurring(r: Pick<Recurring, "note">): boolean {
  return r.note?.startsWith(AUTO_DEBT_NOTE_PREFIX) ?? false;
}

/** Find the seeded Debts / חובות expense category, or first expense category. */
export function resolveDebtsCategoryId(
  categories: Category[],
  preferredId?: string
): string {
  if (preferredId && categories.some((c) => c.id === preferredId)) {
    return preferredId;
  }
  const named = categories.find(
    (c) =>
      c.type === "expense" &&
      (c.name === "חובות" ||
        c.nameEn === "Debts" ||
        c.name.toLowerCase() === "debts")
  );
  if (named) return named.id;
  const firstExpense = categories.find((c) => c.type === "expense");
  return firstExpense?.id ?? "";
}

/**
 * Create / update / deactivate the auto-managed recurring for a debt's monthly payment.
 * Returns the recurring id to store on the debt (or undefined when none).
 */
export async function syncDebtRecurring(
  uid: string,
  bookId: string,
  debt: Pick<
    Debt,
    | "name"
    | "monthlyPayment"
    | "recurringId"
    | "categoryId"
    | "status"
    | "note"
  >,
  categories: Category[]
): Promise<string | undefined> {
  const shouldActive =
    debt.status === "open" && debt.monthlyPayment > 0;
  const categoryId = resolveDebtsCategoryId(categories, debt.categoryId);

  if (!shouldActive) {
    if (debt.recurringId) {
      await updateRecurring(uid, bookId, debt.recurringId, { active: false });
    }
    return debt.recurringId;
  }

  if (!categoryId) {
    return debt.recurringId;
  }

  const noteParts = [AUTO_DEBT_NOTE_PREFIX, debt.name];
  if (debt.note?.trim()) noteParts.push(debt.note.trim());
  const note = noteParts.join(" — ");

  if (debt.recurringId) {
    await updateRecurring(uid, bookId, debt.recurringId, {
      type: "expense",
      amount: debt.monthlyPayment,
      categoryId,
      merchantDisplay: debt.name,
      note,
      cadence: "monthly",
      active: true,
    });
    return debt.recurringId;
  }

  const nextRun = Timestamp.fromDate(addMonths(new Date(), 1));
  const rid = await addRecurring(uid, bookId, {
    type: "expense",
    amount: debt.monthlyPayment,
    categoryId,
    merchantDisplay: debt.name,
    note,
    cadence: "monthly",
    nextRunDate: nextRun,
    active: true,
  });
  return rid;
}

/** Remove the linked recurring when a debt is deleted. */
export async function deleteDebtRecurring(
  uid: string,
  bookId: string,
  recurringId: string | undefined
): Promise<void> {
  if (!recurringId) return;
  await deleteRecurring(uid, bookId, recurringId);
}
