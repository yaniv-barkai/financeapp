"use client";

import React from "react";
import { AlertTriangle, Check, Flag, PartyPopper, PiggyBank } from "lucide-react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { parseDueDate, projectionMonthEnd } from "@/lib/debt-due";
import { getIntlLocale } from "@/lib/i18n";
import type { Debt } from "@/lib/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export type TimelineDebt = {
  debt: Debt;
  /** 1-based position in the pay-off order */
  order: number;
  /** Projection month the debt is paid off, or null if the plan never gets there */
  month: number | null;
  interest: number;
};

type Props = {
  debts: TimelineDebt[];
  fundMonth: number | null;
  fundTarget: number;
  totalDebt: number;
  debtFreeMonth: number | null;
  currency: string;
  onOpenMonth: (month: number) => void;
};

type MonthGroup = { month: number; debts: TimelineDebt[]; fund: boolean };

function groupByMonth(debts: TimelineDebt[], fundMonth: number | null): MonthGroup[] {
  const byMonth = new Map<number, MonthGroup>();
  const at = (month: number) => {
    let g = byMonth.get(month);
    if (!g) {
      g = { month, debts: [], fund: false };
      byMonth.set(month, g);
    }
    return g;
  };
  for (const d of debts) if (d.month !== null) at(d.month).debts.push(d);
  if (fundMonth !== null) at(fundMonth).fund = true;
  return [...byMonth.values()].sort((a, b) => a.month - b.month);
}

export function PayoffTimeline({
  debts,
  fundMonth,
  fundTarget,
  totalDebt,
  debtFreeMonth,
  currency,
  onOpenMonth,
}: Props) {
  const { t, locale } = useLocale();
  const intl = getIntlLocale(locale);
  const monthName = new Intl.DateTimeFormat(intl, { month: "short" });
  const money = (n: number) => formatCurrency(n, currency);

  const groups = groupByMonth(debts, fundMonth);
  const notPaid = debts.filter((d) => d.month === null);
  const rows = groups.length + 1;
  let rowIndex = 0;

  const row = (
    key: string,
    month: number,
    dot: React.ReactNode,
    children: React.ReactNode
  ) => {
    const idx = rowIndex++;
    const date = projectionMonthEnd(month);
    return (
      <li
        key={key}
        className="grid grid-cols-[3.25rem_2rem_minmax(0,1fr)] gap-x-2 sm:grid-cols-[4rem_2rem_minmax(0,1fr)]"
      >
        <div className="pt-1.5 text-end leading-tight">
          <div className="text-sm font-semibold">{monthName.format(date)}</div>
          <div className="text-[11px] tabular-nums text-muted-foreground">
            {date.getFullYear()}
          </div>
        </div>
        <div className="relative flex justify-center">
          <span
            aria-hidden
            className={cn(
              "absolute left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-muted-foreground/20",
              idx === 0 ? "top-4" : "top-0",
              idx === rows - 1 ? "h-4" : "bottom-0"
            )}
          />
          <div className="relative mt-1.5">{dot}</div>
        </div>
        <div className={cn("min-w-0 space-y-2", idx < rows - 1 && "pb-5")}>
          {children}
        </div>
      </li>
    );
  };

  const dot = (className: string, icon?: React.ReactNode) => (
    <span
      className={cn(
        "flex size-5 items-center justify-center rounded-full ring-4 ring-card",
        className
      )}
    >
      {icon}
    </span>
  );

  return (
    <div className="space-y-4">
      <ol>
        {row(
          "today",
          0,
          dot("bg-muted-foreground/30", <Flag className="size-3 text-muted-foreground" />),
          <div className="rounded-lg border border-dashed px-3 py-2.5">
            <div className="text-sm font-medium">{t.payoff_timeline_today}</div>
            <div className="text-xs text-muted-foreground">
              {t.payoff_debt_now}:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {money(totalDebt)}
              </span>
            </div>
          </div>
        )}

        {groups.map((g) =>
          row(
            `m${g.month}`,
            g.month,
            g.month === debtFreeMonth
              ? dot("bg-emerald-500", <PartyPopper className="size-3 text-white" />)
              : g.debts.length > 0
                ? dot("bg-primary", <Check className="size-3 text-primary-foreground" />)
                : dot("bg-emerald-500", <PiggyBank className="size-3 text-white" />),
            <>
              {g.debts.map((d) => {
                const due = d.debt.dueDate ? parseDueDate(d.debt.dueDate) : null;
                const late = due !== null && projectionMonthEnd(g.month) > due;
                return (
                  <button
                    key={d.debt.id}
                    type="button"
                    onClick={() => onOpenMonth(g.month)}
                    title={t.payoff_schedule_show}
                    className="block w-full rounded-lg border bg-card px-3 py-2.5 text-start transition-colors hover:border-primary/50 hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                            d.debt.forcePhase1
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                              : "bg-primary/10 text-primary"
                          )}
                        >
                          {d.order}
                        </span>
                        <span className="truncate text-sm font-medium">{d.debt.name}</span>
                      </div>
                      <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {t.payoff_payoff_at.replace("{n}", String(g.month))}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t.payoff_balance_label}{" "}
                      <span className="tabular-nums text-foreground">
                        {money(d.debt.balance)}
                      </span>
                      {d.interest > 0 && (
                        <>
                          {" · "}
                          {t.payoff_interest_label}{" "}
                          <span className="tabular-nums text-red-500">
                            {money(d.interest)}
                          </span>
                        </>
                      )}
                    </div>
                    {late && due && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle className="size-3.5 shrink-0" />
                        {t.payoff_after_due.replace("{date}", formatDate(due))}
                      </div>
                    )}
                  </button>
                );
              })}
              {g.fund && (
                <button
                  type="button"
                  onClick={() => onOpenMonth(g.month)}
                  title={t.payoff_schedule_show}
                  className="flex w-full items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 text-start transition-colors hover:bg-emerald-500/10"
                >
                  <PiggyBank className="size-4 shrink-0 text-emerald-600" />
                  <span className="min-w-0 flex-1 text-sm font-medium">
                    {t.payoff_timeline_fund_done}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-emerald-700 dark:text-emerald-400">
                    {money(fundTarget)}
                  </span>
                </button>
              )}
              {g.month === debtFreeMonth && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-emerald-700 dark:text-emerald-400">
                  <PartyPopper className="size-4 shrink-0" />
                  <span className="text-sm font-semibold">{t.payoff_timeline_free}</span>
                </div>
              )}
            </>
          )
        )}
      </ol>

      {notPaid.length > 0 && (
        <div className="rounded-lg border border-dashed p-3">
          <div className="text-xs font-medium text-muted-foreground">
            {t.payoff_timeline_not_paid}
          </div>
          <ul className="mt-1.5 space-y-1 text-sm">
            {notPaid.map((d) => (
              <li key={d.debt.id} className="flex justify-between gap-2">
                <span className="truncate">
                  <span className="text-muted-foreground tabular-nums">{d.order}. </span>
                  {d.debt.name}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {money(d.debt.balance)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
