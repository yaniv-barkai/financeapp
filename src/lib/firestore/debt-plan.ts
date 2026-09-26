import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { SnowballOneTimeIncome, SnowballPlan } from "../types";
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
    oneTimeIncomes: (data.oneTimeIncomes as SnowballOneTimeIncome[]) ?? [],
    emergencyFundMonths: Number(data.emergencyFundMonths) || 3,
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
      oneTimeIncomes: data.oneTimeIncomes,
      emergencyFundMonths: data.emergencyFundMonths,
      monthlyIncomeForFund: data.monthlyIncomeForFund,
      updatedAt: serverTimestamp(),
    }),
    { merge: true }
  );
}
