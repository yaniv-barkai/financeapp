"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, PartyPopper } from "lucide-react";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { SnowballScheduleEntry } from "@/lib/snowball";
import { projectionMonthEnd } from "@/lib/debt-due";
import { getIntlLocale } from "@/lib/i18n";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: SnowballScheduleEntry[];
  debtNames: Record<string, string>;
  currency: string;
  /** Month to expand and scroll to when the dialog opens */
  focusMonth: number | null;
};

function sum(values: Record<string, number>): number {
  let total = 0;
  for (const v of Object.values(values)) total += v;
  return total;
}

export function PayoffScheduleDialog({
  open,
  onOpenChange,
  ...listProps
}: Props) {
  const { t, locale } = useLocale();
  const isRtl = locale === "he";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir={isRtl ? "rtl" : "ltr"}
        className="max-w-2xl max-h-[85vh] grid-rows-[auto_1fr] p-0 gap-0 overflow-hidden"
      >
        <DialogHeader className="p-5 pb-3 border-b">
          <DialogTitle>{t.payoff_schedule_title}</DialogTitle>
          <DialogDescription>{t.payoff_schedule_desc}</DialogDescription>
        </DialogHeader>
        <ScheduleList {...listProps} />
      </DialogContent>
    </Dialog>
  );
}

/** Mounted fresh each time the dialog opens, so expansion resets to the focused month. */
function ScheduleList({
  schedule,
  debtNames,
  currency,
  focusMonth,
}: Omit<Props, "open" | "onOpenChange">) {
  const { t, locale } = useLocale();
  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set(focusMonth ? [focusMonth] : [])
  );
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!focusMonth) return;
    const id = window.setTimeout(() => {
      rowRefs.current[focusMonth]?.scrollIntoView({ block: "start" });
    }, 50);
    return () => window.clearTimeout(id);
  }, [focusMonth]);

  const monthFormatter = new Intl.DateTimeFormat(getIntlLocale(locale), {
    month: "short",
    year: "numeric",
  });
  const money = (n: number) => formatCurrency(n, currency);

  const toggle = (month: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });

  const stepLabel = (phase: 1 | 2 | 3) =>
    phase === 1
      ? t.payoff_schedule_step1
      : phase === 2
        ? t.payoff_schedule_step2
        : t.payoff_schedule_step3;

  return (
    <div className="overflow-y-auto p-3 space-y-2">
      {schedule.length === 0 && (
        <p className="text-sm text-muted-foreground p-2">
          {t.payoff_schedule_empty}
        </p>
      )}
      {schedule.map((entry) => {
        const isOpen = expanded.has(entry.month);
        const interest = sum(entry.interest);
        const paid = sum(entry.payments);
        const debtLeft = sum(entry.balances);
        const debtIds = Object.keys(entry.startBalances);
        return (
          <div
            key={entry.month}
            ref={(el) => {
              rowRefs.current[entry.month] = el;
            }}
            className={cn(
              "rounded-lg border scroll-mt-2",
              entry.month === focusMonth && "border-primary"
            )}
          >
            <button
              type="button"
              onClick={() => toggle(entry.month)}
              aria-expanded={isOpen}
              className="w-full p-3 text-start hover:bg-muted/50 rounded-lg"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium">
                    {t.payoff_payoff_at.replace("{n}", String(entry.month))}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {monthFormatter.format(projectionMonthEnd(entry.month))}
                  </span>
                  <span className="text-[11px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground truncate">
                    {stepLabel(entry.phase)}
                  </span>
                  {entry.paidOffDebtIds.length > 0 && (
                    <PartyPopper className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
              </div>
              <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>
                  {t.payoff_schedule_in}:{" "}
                  <span className="text-foreground">{money(entry.moneyIn)}</span>
                </span>
                <span>
                  {t.payoff_schedule_interest}:{" "}
                  <span className={interest > 0 ? "text-red-500" : "text-foreground"}>
                    {money(interest)}
                  </span>
                </span>
                <span>
                  {t.payoff_schedule_paid}:{" "}
                  <span className="text-foreground">{money(paid)}</span>
                </span>
                <span>
                  {t.payoff_schedule_debt_left}:{" "}
                  <span className="text-foreground font-medium">{money(debtLeft)}</span>
                </span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t px-3 py-2 space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">
                    {t.payoff_schedule_available}
                  </span>
                  <span>{money(entry.moneyIn - entry.oneTimeIn)}</span>
                </div>
                {entry.oneTimeIn > 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">
                      + {t.payoff_schedule_one_time}
                    </span>
                    <span className="text-green-600">{money(entry.oneTimeIn)}</span>
                  </div>
                )}

                {debtIds.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="text-start font-normal py-1">
                            {t.payoff_schedule_col_debt}
                          </th>
                          <th className="text-end font-normal py-1 px-1">
                            {t.payoff_schedule_col_start}
                          </th>
                          <th className="text-end font-normal py-1 px-1">
                            + {t.payoff_schedule_col_interest}
                          </th>
                          <th className="text-end font-normal py-1 px-1">
                            − {t.payoff_schedule_col_paid}
                          </th>
                          <th className="text-end font-normal py-1">
                            = {t.payoff_schedule_col_left}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {debtIds.map((id) => {
                          const paidOff = entry.paidOffDebtIds.includes(id);
                          return (
                            <tr key={id} className="border-t">
                              <td className="py-1 pe-2">
                                <span className="block truncate max-w-[10rem]">
                                  {debtNames[id] ?? id}
                                </span>
                                {paidOff && (
                                  <span className="text-green-600">
                                    {t.payoff_schedule_paid_off}
                                  </span>
                                )}
                              </td>
                              <td className="text-end py-1 px-1 whitespace-nowrap">
                                {money(entry.startBalances[id])}
                              </td>
                              <td className="text-end py-1 px-1 whitespace-nowrap text-red-500">
                                {(entry.interest[id] ?? 0) > 0
                                  ? money(entry.interest[id])
                                  : "—"}
                              </td>
                              <td className="text-end py-1 px-1 whitespace-nowrap">
                                {(entry.payments[id] ?? 0) > 0
                                  ? money(entry.payments[id])
                                  : "—"}
                              </td>
                              <td
                                className={cn(
                                  "text-end py-1 whitespace-nowrap font-medium",
                                  paidOff && "text-green-600"
                                )}
                              >
                                {money(entry.balances[id] ?? 0)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {(entry.emergencyFundAdded > 0 || entry.emergencyFund > 0) && (
                  <div className="flex justify-between gap-2 border-t pt-2">
                    <span className="text-muted-foreground">
                      {t.payoff_schedule_ef}
                    </span>
                    <span>
                      {entry.emergencyFundAdded > 0 && (
                        <span className="text-green-600">
                          +{money(entry.emergencyFundAdded)} ·{" "}
                        </span>
                      )}
                      {money(entry.emergencyFund)}
                    </span>
                  </div>
                )}
                {entry.unused > 0.005 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">
                      {t.payoff_schedule_unused}
                    </span>
                    <span>{money(entry.unused)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
