import type { Debt } from "./types";

/** Israeli prime rate (Bank of Israel rate + 1.5%). Update when the BoI changes its rate. */
export const ISRAEL_PRIME_RATE = 4.75;
export const ISRAEL_PRIME_AS_OF = "2026-09-01";

export function effectiveAnnualRate(
  debt: Pick<Debt, "interestType" | "annualInterestRate" | "primeMargin">
): number {
  const rate =
    debt.interestType === "prime"
      ? ISRAEL_PRIME_RATE + (debt.primeMargin || 0)
      : debt.annualInterestRate || 0;
  return Math.max(0, Math.round(rate * 1000) / 1000);
}
