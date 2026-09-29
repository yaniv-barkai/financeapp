import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { SnowballOneTimeIncome, SnowballPlan } from "../types";
import { monthKeyToProjection, projectionMonthKey } from "../debt-due";
import { assertOwner } from "./auth";

export const DEBT_PLAN_DOC_ID = "main";

function debtPlanRef(uid: string, bookId: string) {
  assertOwner(uid);
  return doc(db, "users", uid, "books", bookId, "debtPlans", DEBT_PLAN_DOC_ID);
}

/** Firestore rejects undefined field values — strip them before write. */
function withoutUndefined<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as T;
}

/**
 * applyMonth is the source of truth, so a saved date stays put as time passes.
 * Older plans only stored applyAfterMonths; pin those to a calendar month.
 */
function normalizeOneTime(item: SnowballOneTimeIncome): SnowballOneTimeIncome {
  const projection = item.applyMonth ? monthKeyToProjection(item.applyMonth) : null;
  if (item.applyMonth && projection !== null) {
    return { ...item, applyAfterMonths: projection - 1 };
  }
  const after = Math.max(0, Number(item.applyAfterMonths) || 0);
  return { ...item, applyAfterMonths: after, applyMonth: projectionMonthKey(after + 1) };
}

export function emptyDebtPlan(): SnowballPlan {
  return {
    nominalMonthlyIncome: 0,
    monthlyExtra: 0,
    oneTimeIncomes: [],
    emergencyFundMonths: 3,
    monthlyIncomeForFund: 0,
  };
}

export async function getDebtPlan(
  uid: string,
  bookId: string
): Promise<SnowballPlan | null> {
  const snap = await getDoc(debtPlanRef(uid, bookId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    nominalMonthlyIncome: Number(data.nominalMonthlyIncome) || 0,
    monthlyExtra: Number(data.monthlyExtra) || 0,
    oneTimeIncomes: ((data.oneTimeIncomes as SnowballOneTimeIncome[]) ?? []).map(
      normalizeOneTime
    ),
    emergencyFundMonths:
      data.emergencyFundMonths === undefined ? 3 : Number(data.emergencyFundMonths) || 0,
    monthlyIncomeForFund: Number(data.monthlyIncomeForFund) || 0,
    updatedAt: data.updatedAt,
  };
}

export async function saveDebtPlan(
  uid: string,
  bookId: string,
  data: Omit<SnowballPlan, "updatedAt">
): Promise<void> {
  await setDoc(
    debtPlanRef(uid, bookId),
    withoutUndefined({
      nominalMonthlyIncome: data.nominalMonthlyIncome,
      monthlyExtra: data.monthlyExtra,
      oneTimeIncomes: data.oneTimeIncomes.map((item) => withoutUndefined({ ...item })),
      emergencyFundMonths: data.emergencyFundMonths,
      monthlyIncomeForFund: data.monthlyIncomeForFund,
      updatedAt: serverTimestamp(),
    })
  );
}
