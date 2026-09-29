import { effectiveAnnualRate } from "./prime";
import type { Debt, SnowballPlan } from "./types";

/** Step 1 holds only debts the user marked "Pay first". */
export function isPhase1Debt(debt: { forcePhase1: boolean }): boolean {
  return debt.forcePhase1;
}

export const SNOWBALL_MAX_MONTHS = 600;

interface PayoffOrderFields {
  name: string;
  balance: number;
  forcePhase1: boolean;
  payoffOrder?: number;
  annualRate: number;
}

/**
 * The one pay-off order used everywhere: "Pay first" debts, then the user's
 * manual order, then debts with interest before interest-free, smallest first.
 */
export function comparePayoffOrder(
  a: PayoffOrderFields,
  b: PayoffOrderFields
): number {
  if (a.forcePhase1 !== b.forcePhase1) return a.forcePhase1 ? -1 : 1;
  const aOrder = a.payoffOrder ?? Infinity;
  const bOrder = b.payoffOrder ?? Infinity;
  if (aOrder !== bOrder) return aOrder < bOrder ? -1 : 1;
  const aInterest = a.annualRate > 0;
  const bInterest = b.annualRate > 0;
  if (aInterest !== bInterest) return aInterest ? -1 : 1;
  return a.balance - b.balance || a.name.localeCompare(b.name);
}

export function sortDebtsByPayoffOrder<
  T extends Pick<
    Debt,
    | "name"
    | "balance"
    | "forcePhase1"
    | "payoffOrder"
    | "interestType"
    | "annualInterestRate"
    | "primeMargin"
  >,
>(debts: T[]): T[] {
  const withRate = debts.map((d) => ({
    debt: d,
    key: { ...d, annualRate: effectiveAnnualRate(d) },
  }));
  withRate.sort((a, b) => comparePayoffOrder(a.key, b.key));
  return withRate.map((x) => x.debt);
}

export interface SnowballDebtInput {
  id: string;
  name: string;
  balance: number;
  monthlyPayment: number;
  forcePhase1: boolean;
  /** Annual percent; accrues monthly (rate / 12) on the open balance. */
  annualInterestRate?: number;
  /** Manual position in the pay-off order (lower = paid first) */
  payoffOrder?: number;
}

export interface SnowballScheduleEntry {
  month: number;
  phase: 1 | 2 | 3;
  /** Monthly surplus plus any one-time money that lands this month */
  moneyIn: number;
  oneTimeIn: number;
  /** Open balances at the start of the month, before interest */
  startBalances: Record<string, number>;
  /** Interest charged this month, per debt */
  interest: Record<string, number>;
  /** Paid this month (monthly payment + extra), per debt */
  payments: Record<string, number>;
  /** Remaining balances after this month's payments */
  balances: Record<string, number>;
  emergencyFundAdded: number;
  emergencyFund: number;
  /** Money left over after debts and the fund are covered */
  unused: number;
  paidOffDebtIds: string[];
}

export interface SnowballResult {
  phase1Months: number | null;
  phase2Months: number | null;
  phase3Months: number | null;
  totalMonths: number | null;
  /** Month index (1-based) when each debt is paid off */
  debtPayoffMonth: Record<string, number>;
  /** Interest charged over the simulated months (up to payoff or stop). */
  totalInterest: number;
  debtInterest: Record<string, number>;
  emergencyFundTarget: number;
  stuck: boolean;
  stuckReason?: "insufficient_for_minimums" | "max_months";
  schedule: SnowballScheduleEntry[];
}

function monthlyRate(annualInterestRate: number | undefined): number {
  const r = annualInterestRate ?? 0;
  return r > 0 ? r / 100 / 12 : 0;
}

export interface DebtInterestEstimate {
  /** null when the monthly payment never covers the interest */
  months: number | null;
  totalInterest: number | null;
  /** Interest charged this month on the current balance */
  monthlyInterestNow: number;
}

/**
 * Interest paid on a single debt if only its fixed monthly payment is made.
 * Returns null fields when there is no monthly payment or it can't outpace interest.
 */
export function estimateDebtInterest(
  balance: number,
  annualInterestRate: number,
  monthlyPayment: number
): DebtInterestEstimate {
  if (balance <= 0) {
    return { months: 0, totalInterest: 0, monthlyInterestNow: 0 };
  }
  const rate = monthlyRate(annualInterestRate);
  const monthlyInterestNow = balance * rate;
  if (monthlyPayment <= 0) {
    return {
      months: null,
      totalInterest: rate > 0 ? null : 0,
      monthlyInterestNow,
    };
  }
  if (monthlyInterestNow >= monthlyPayment) {
    return { months: null, totalInterest: null, monthlyInterestNow };
  }
  let remaining = balance;
  let interest = 0;
  for (let month = 1; month <= SNOWBALL_MAX_MONTHS; month++) {
    const charge = remaining * rate;
    interest += charge;
    remaining += charge - monthlyPayment;
    if (remaining <= 1e-9) {
      return { months: month, totalInterest: interest, monthlyInterestNow };
    }
  }
  return { months: null, totalInterest: null, monthlyInterestNow };
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
    | "id"
    | "name"
    | "balance"
    | "monthlyPayment"
    | "interestType"
    | "annualInterestRate"
    | "primeMargin"
    | "forcePhase1"
    | "payoffOrder"
    | "status"
  >
): SnowballDebtInput | null {
  if (debt.status !== "open" || debt.balance <= 0) return null;
  return {
    id: debt.id,
    name: debt.name,
    balance: debt.balance,
    monthlyPayment: Math.max(0, debt.monthlyPayment),
    forcePhase1: debt.forcePhase1,
    annualInterestRate: effectiveAnnualRate(debt),
    payoffOrder: debt.payoffOrder,
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
  const rates: Record<string, number> = {};
  const debtInterest: Record<string, number> = {};
  let totalInterest = 0;

  // Order is fixed up front so the plan pays debts in the same order the user sees.
  const ordered = debts
    .filter((d) => d.balance > 0)
    .sort((a, b) =>
      comparePayoffOrder(
        { ...a, annualRate: a.annualInterestRate ?? 0 },
        { ...b, annualRate: b.annualInterestRate ?? 0 }
      )
    );

  for (const d of ordered) {
    balances[d.id] = d.balance;
    mins[d.id] = d.monthlyPayment;
    names[d.id] = d.name;
    rates[d.id] = monthlyRate(d.annualInterestRate);
    debtInterest[d.id] = 0;
  }

  const phase1Ids = ordered.filter(isPhase1Debt).map((d) => d.id);
  const phase3Ids = ordered.filter((d) => !isPhase1Debt(d)).map((d) => d.id);

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
    totalInterest: 0,
    debtInterest,
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
    const oneTimeIn = oneTimeForMonth(plan, month);
    const moneyIn = base + oneTimeIn;
    let cash = moneyIn;
    let emergencyFundAdded = 0;
    const paidOffThisMonth: string[] = [];
    const interestThisMonth: Record<string, number> = {};
    const paymentsThisMonth: Record<string, number> = {};

    const openIds = Object.keys(balances).filter((id) => balances[id] > 0);
    const startBalances: Record<string, number> = {};
    for (const id of openIds) startBalances[id] = balances[id];

    for (const id of openIds) {
      const charge = balances[id] * rates[id];
      if (charge <= 0) continue;
      balances[id] += charge;
      debtInterest[id] += charge;
      totalInterest += charge;
      interestThisMonth[id] = charge;
    }

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
        totalInterest,
        debtInterest,
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
      paymentsThisMonth[id] = (paymentsThisMonth[id] ?? 0) + minPay;
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
        paymentsThisMonth[id] = (paymentsThisMonth[id] ?? 0) + pay;
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

    const phase1Done = () => phase1Ids.every((id) => balances[id] <= 0);
    const efDoneNow = () => ef >= efTarget - 1e-9;

    // The step the month starts in; money left after a step rolls into the next one.
    const phase: 1 | 2 | 3 = !phase1Done() ? 1 : !efDoneNow() ? 2 : 3;

    attack(phase1Ids);
    if (phase1Done() && !efDoneNow()) {
      const toFund = Math.min(cash, efTarget - ef);
      ef += toFund;
      cash -= toFund;
      emergencyFundAdded = toFund;
    }
    if (phase1Done() && efDoneNow()) {
      attack(phase3Ids);
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
      moneyIn,
      oneTimeIn,
      startBalances,
      interest: interestThisMonth,
      payments: paymentsThisMonth,
      balances: { ...balances },
      emergencyFundAdded,
      emergencyFund: ef,
      unused: Math.max(0, cash),
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
        totalInterest,
        debtInterest,
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
    totalInterest,
    debtInterest,
    emergencyFundTarget: efTarget,
    stuck: true,
    stuckReason: "max_months",
    schedule,
  };
}
