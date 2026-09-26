import type { Debt, SnowballPlan } from "./types";

export function isPhase1Debt(debt: {
  monthlyPayment: number;
  forcePhase1: boolean;
}): boolean {
  return debt.monthlyPayment <= 0 || debt.forcePhase1;
}

export const SNOWBALL_MAX_MONTHS = 600;

export interface SnowballDebtInput {
  id: string;
  name: string;
  balance: number;
  monthlyPayment: number;
  forcePhase1: boolean;
}

export interface SnowballScheduleEntry {
  month: number;
  phase: 1 | 2 | 3;
  /** Remaining balances after this month's payments */
  balances: Record<string, number>;
  emergencyFund: number;
  paidOffDebtIds: string[];
}

export interface SnowballResult {
  phase1Months: number | null;
  phase2Months: number | null;
  phase3Months: number | null;
  totalMonths: number | null;
  /** Month index (1-based) when each debt is paid off */
  debtPayoffMonth: Record<string, number>;
  emergencyFundTarget: number;
  stuck: boolean;
  stuckReason?: "insufficient_for_minimums" | "max_months";
  schedule: SnowballScheduleEntry[];
}

function monthlySurplus(plan: Pick<SnowballPlan, "nominalMonthlyIncome" | "monthlyExtra">): number {
  const base =
    plan.nominalMonthlyIncome > 0
      ? plan.nominalMonthlyIncome
      : plan.monthlyExtra;
  return Math.max(0, base);
}

function oneTimeForMonth(
  plan: Pick<SnowballPlan, "oneTimeIncomes">,
  month: number
): number {
  let sum = 0;
  for (const item of plan.oneTimeIncomes) {
    if (item.applyAfterMonths === month - 1 && item.amount > 0) {
      sum += item.amount;
    }
  }
  return sum;
}

export function toSnowballDebtInput(
  debt: Pick<
    Debt,
    "id" | "name" | "balance" | "monthlyPayment" | "forcePhase1" | "status"
  >
): SnowballDebtInput | null {
  if (debt.status !== "open" || debt.balance <= 0) return null;
  return {
    id: debt.id,
    name: debt.name,
    balance: debt.balance,
    monthlyPayment: Math.max(0, debt.monthlyPayment),
    forcePhase1: debt.forcePhase1,
  };
}

/**
 * Project months for phase 1 (small / no-min / forced debts),
 * phase 2 (emergency fund), and phase 3 (remaining with cascading mins).
 */
export function runSnowball(
  debts: SnowballDebtInput[],
  plan: Pick<
    SnowballPlan,
    | "nominalMonthlyIncome"
    | "monthlyExtra"
    | "oneTimeIncomes"
    | "emergencyFundMonths"
    | "monthlyIncomeForFund"
  >
): SnowballResult {
  const balances: Record<string, number> = {};
  const mins: Record<string, number> = {};
  const names: Record<string, string> = {};

  for (const d of debts) {
    if (d.balance <= 0) continue;
    balances[d.id] = d.balance;
    mins[d.id] = d.monthlyPayment;
    names[d.id] = d.name;
  }

  const phase1Ids = debts
    .filter((d) => balances[d.id] !== undefined && isPhase1Debt(d))
    .sort((a, b) => a.balance - b.balance || a.name.localeCompare(b.name))
    .map((d) => d.id);

  const phase3Ids = debts
    .filter((d) => balances[d.id] !== undefined && !isPhase1Debt(d))
    .sort((a, b) => a.balance - b.balance || a.name.localeCompare(b.name))
    .map((d) => d.id);

  const efTarget = Math.max(
    0,
    plan.emergencyFundMonths * Math.max(0, plan.monthlyIncomeForFund)
  );

  const empty: SnowballResult = {
    phase1Months: phase1Ids.length === 0 ? 0 : null,
    phase2Months: efTarget <= 0 ? 0 : null,
    phase3Months: phase3Ids.length === 0 ? 0 : null,
    totalMonths: null,
    debtPayoffMonth: {},
    emergencyFundTarget: efTarget,
    stuck: false,
    schedule: [],
  };

  if (
    Object.keys(balances).length === 0 &&
    efTarget <= 0
  ) {
    return { ...empty, totalMonths: 0 };
  }

  let ef = 0;
  let phase1DoneAt: number | null = phase1Ids.length === 0 ? 0 : null;
  let phase2DoneAt: number | null = efTarget <= 0 ? 0 : null;
  let phase3DoneAt: number | null = phase3Ids.length === 0 ? 0 : null;
  const debtPayoffMonth: Record<string, number> = {};
  const schedule: SnowballScheduleEntry[] = [];
  const base = monthlySurplus(plan);

  for (let month = 1; month <= SNOWBALL_MAX_MONTHS; month++) {
    let cash = base + oneTimeForMonth(plan, month);
    const paidOffThisMonth: string[] = [];

    const openIds = Object.keys(balances).filter((id) => balances[id] > 0);

    // 1) Pay minimums on all open debts
    let minTotal = 0;
    for (const id of openIds) {
      const minPay = Math.min(balances[id], mins[id] || 0);
      minTotal += minPay;
    }
    if (minTotal > cash + 1e-9) {
      return {
        phase1Months: phase1DoneAt,
        phase2Months:
          phase2DoneAt === null
            ? null
            : phase1DoneAt !== null
              ? phase2DoneAt - phase1DoneAt
              : phase2DoneAt,
        phase3Months: null,
        totalMonths: null,
        debtPayoffMonth,
        emergencyFundTarget: efTarget,
        stuck: true,
        stuckReason: "insufficient_for_minimums",
        schedule,
      };
    }

    for (const id of openIds) {
      const minPay = Math.min(balances[id], mins[id] || 0);
      if (minPay <= 0) continue;
      balances[id] -= minPay;
      cash -= minPay;
      if (balances[id] <= 1e-9) {
        balances[id] = 0;
        if (!debtPayoffMonth[id]) {
          debtPayoffMonth[id] = month;
          paidOffThisMonth.push(id);
        }
      }
    }

    // Remaining open after mins
    const stillOpen = () =>
      Object.keys(balances).filter((id) => balances[id] > 0);

    const attack = (orderedIds: string[]) => {
      let remaining = cash;
      for (const id of orderedIds) {
        if (remaining <= 1e-9) break;
        if (balances[id] <= 0) continue;
        const pay = Math.min(balances[id], remaining);
        balances[id] -= pay;
        remaining -= pay;
        if (balances[id] <= 1e-9) {
          balances[id] = 0;
          if (!debtPayoffMonth[id]) {
            debtPayoffMonth[id] = month;
            paidOffThisMonth.push(id);
          }
        }
      }
      cash = remaining;
    };

    const p1Open = phase1Ids.filter((id) => balances[id] > 0);
    const p3Open = phase3Ids.filter((id) => balances[id] > 0);

    let phase: 1 | 2 | 3;
    if (p1Open.length > 0) {
      phase = 1;
      // Re-sort by current balance for true snowball
      p1Open.sort(
        (a, b) =>
          balances[a] - balances[b] ||
          (names[a] ?? "").localeCompare(names[b] ?? "")
      );
      attack(p1Open);
    } else if (ef < efTarget - 1e-9) {
      phase = 2;
      const toFund = Math.min(cash, efTarget - ef);
      ef += toFund;
      cash -= toFund;
    } else {
      phase = 3;
      p3Open.sort(
        (a, b) =>
          balances[a] - balances[b] ||
          (names[a] ?? "").localeCompare(names[b] ?? "")
      );
      attack(p3Open);
    }

    if (
      phase1DoneAt === null &&
      phase1Ids.every((id) => (balances[id] ?? 0) <= 0)
    ) {
      phase1DoneAt = month;
    }

    if (
      phase2DoneAt === null &&
      phase1DoneAt !== null &&
      ef >= efTarget - 1e-9
    ) {
      phase2DoneAt = month;
    }

    if (
      phase3DoneAt === null &&
      phase2DoneAt !== null &&
      phase3Ids.every((id) => (balances[id] ?? 0) <= 0)
    ) {
      phase3DoneAt = month;
    }

    schedule.push({
      month,
      phase,
      balances: { ...balances },
      emergencyFund: ef,
      paidOffDebtIds: [...paidOffThisMonth],
    });

    const allDebtsDone = stillOpen().length === 0;
    const efDone = ef >= efTarget - 1e-9;
    if (allDebtsDone && efDone) {
      const p1 = phase1DoneAt ?? 0;
      const p2 = phase2DoneAt ?? p1;
      const p3 = phase3DoneAt ?? p2;
      return {
        phase1Months: p1,
        phase2Months: Math.max(0, p2 - p1),
        phase3Months: Math.max(0, p3 - p2),
        totalMonths: month,
        debtPayoffMonth,
        emergencyFundTarget: efTarget,
        stuck: false,
        schedule,
      };
    }
  }

  return {
    phase1Months: phase1DoneAt,
    phase2Months:
      phase2DoneAt !== null && phase1DoneAt !== null
        ? Math.max(0, phase2DoneAt - phase1DoneAt)
        : null,
    phase3Months: null,
    totalMonths: null,
    debtPayoffMonth,
    emergencyFundTarget: efTarget,
    stuck: true,
    stuckReason: "max_months",
    schedule,
  };
}
