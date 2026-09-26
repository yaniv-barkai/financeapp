"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useAppStore } from "@/lib/store";
import { getDebts } from "@/lib/firestore/debts";
import {
  emptyDebtPlan,
  getDebtPlan,
  saveDebtPlan,
} from "@/lib/firestore/debt-plan";
import {
  runSnowball,
  toSnowballDebtInput,
} from "@/lib/snowball";
import {
  Debt,
  SnowballOneTimeIncome,
  SnowballPlan,
} from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function parsePositive(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function monthsLabel(
  template: string,
  n: number | null,
  doneLabel: string
): string {
  if (n === null) return "—";
  if (n === 0) return doneLabel;
  return template.replace("{n}", String(n));
}

type Props = {
  /** Net from the budget simulation tab (income − expenses). */
  budgetSimNet: number;
};

export function DebtPayoffPanel({ budgetSimNet }: Props) {
  const { user } = useAuth();
  const { activeBookId, currency } = useAppStore();
  const { t, locale } = useLocale();
  const isRtl = locale === "he";
  const align = isRtl ? "text-right" : "text-left";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [availableStr, setAvailableStr] = useState("");
  const [efMonthsStr, setEfMonthsStr] = useState("3");
  const [efIncomeStr, setEfIncomeStr] = useState("");
  const [oneTimes, setOneTimes] = useState<SnowballOneTimeIncome[]>([]);

  const load = useCallback(async () => {
    if (!user || !activeBookId) return;
    setLoading(true);
    try {
      const [d, p] = await Promise.all([
        getDebts(user.uid, activeBookId),
        getDebtPlan(user.uid, activeBookId),
      ]);
      setDebts(d);
      const planData = p ?? emptyDebtPlan();
      // Prefer the primary surplus field; fall back to the legacy extra field.
      const available =
        planData.nominalMonthlyIncome > 0
          ? planData.nominalMonthlyIncome
          : planData.monthlyExtra;
      setAvailableStr(available > 0 ? String(available) : "");
      setEfMonthsStr(String(planData.emergencyFundMonths || 3));
      setEfIncomeStr(
        planData.monthlyIncomeForFund > 0
          ? String(planData.monthlyIncomeForFund)
          : ""
      );
      setOneTimes(planData.oneTimeIncomes ?? []);
    } catch {
      toast.error(t.payoff_load_error);
    } finally {
      setLoading(false);
    }
  }, [user, activeBookId, t.payoff_load_error]);

  useEffect(() => {
    void load();
  }, [load]);

  const livePlan: SnowballPlan = useMemo(
    () => ({
      nominalMonthlyIncome: parsePositive(availableStr),
      monthlyExtra: 0,
      oneTimeIncomes: oneTimes,
      emergencyFundMonths: Math.max(0, parseFloat(efMonthsStr) || 0),
      monthlyIncomeForFund: parsePositive(efIncomeStr),
    }),
    [availableStr, oneTimes, efMonthsStr, efIncomeStr]
  );

  const result = useMemo(() => {
    const inputs = debts
      .map(toSnowballDebtInput)
      .filter((d): d is NonNullable<typeof d> => d !== null);
    return runSnowball(inputs, livePlan);
  }, [debts, livePlan]);

  const openDebts = useMemo(
    () => debts.filter((d) => d.status === "open" && d.balance > 0),
    [debts]
  );

  const handleSave = async () => {
    if (!user || !activeBookId) return;
    setSaving(true);
    try {
      await saveDebtPlan(user.uid, activeBookId, livePlan);
      toast.success(t.payoff_plan_saved);
    } catch {
      toast.error(t.payoff_plan_save_error);
    } finally {
      setSaving(false);
    }
  };

  const useBudgetNet = () => {
    const net = Math.round(budgetSimNet);
    if (net <= 0) {
      toast.info(t.payoff_use_budget_empty);
      return;
    }
    setAvailableStr(String(net));
    toast.success(t.payoff_use_budget_done);
  };

  const addOneTime = () => {
    setOneTimes((rows) => [
      ...rows,
      {
        id: `ot_${Date.now()}`,
        label: "",
        amount: 0,
        applyAfterMonths: 0,
      },
    ]);
  };

  const surplus = livePlan.nominalMonthlyIncome;

  if (loading) {
    return (
      <p className={cn("text-sm text-muted-foreground py-8", align)}>
        {t.payoff_loading}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className={cn("text-sm text-muted-foreground", align)}>
        {t.payoff_subtitle}{" "}
        <Link href="/debts" className="text-primary underline-offset-2 hover:underline">
          {t.payoff_manage_debts}
        </Link>
      </p>

      {openDebts.length === 0 && (
        <p className={cn("text-sm text-muted-foreground", align)}>
          {t.payoff_no_debts}
        </p>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn("text-base", align)}>
            {t.payoff_settings_title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t.payoff_available_monthly}</Label>
              <Input
                inputMode="decimal"
                value={availableStr}
                onChange={(e) => setAvailableStr(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                {t.payoff_available_monthly_hint}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={useBudgetNet}
              >
                {t.payoff_use_budget_net}
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>{t.payoff_ef_months}</Label>
              <Input
                inputMode="decimal"
                value={efMonthsStr}
                onChange={(e) => setEfMonthsStr(e.target.value)}
                placeholder="3"
              />
              <p className="text-xs text-muted-foreground">
                {t.payoff_ef_months_hint}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>{t.payoff_ef_income}</Label>
              <Input
                inputMode="decimal"
                value={efIncomeStr}
                onChange={(e) => setEfIncomeStr(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                {t.payoff_ef_income_hint}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>{t.payoff_one_time}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOneTime}
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                {t.payoff_one_time_add}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.payoff_one_time_hint}
            </p>
            {oneTimes.map((row, idx) => (
              <div
                key={row.id}
                className="grid gap-2 sm:grid-cols-[1fr_100px_90px_auto] items-end"
              >
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">
                    {t.payoff_one_time_label}
                  </span>
                  <Input
                    value={row.label}
                    onChange={(e) =>
                      setOneTimes((rows) =>
                        rows.map((r, i) =>
                          i === idx ? { ...r, label: e.target.value } : r
                        )
                      )
                    }
                    placeholder={t.payoff_one_time_label_placeholder}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">
                    {t.payoff_one_time_amount}
                  </span>
                  <Input
                    inputMode="decimal"
                    value={row.amount > 0 ? String(row.amount) : ""}
                    onChange={(e) =>
                      setOneTimes((rows) =>
                        rows.map((r, i) =>
                          i === idx
                            ? { ...r, amount: parsePositive(e.target.value) }
                            : r
                        )
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">
                    {t.payoff_one_time_month}
                  </span>
                  <Input
                    inputMode="numeric"
                    value={String(row.applyAfterMonths)}
                    onChange={(e) =>
                      setOneTimes((rows) =>
                        rows.map((r, i) =>
                          i === idx
                            ? {
                                ...r,
                                applyAfterMonths: Math.max(
                                  0,
                                  parseInt(e.target.value, 10) || 0
                                ),
                              }
                            : r
                        )
                      )
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  title={t.payoff_one_time_remove}
                  onClick={() =>
                    setOneTimes((rows) => rows.filter((_, i) => i !== idx))
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? t.payoff_saving : t.payoff_save_plan}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={cn("text-base", align)}>
            {t.payoff_results_title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {surplus <= 0 ? (
            <p className="text-sm text-muted-foreground">
              {t.payoff_no_available}
            </p>
          ) : result.stuck ? (
            <p className="text-sm text-destructive">
              {result.stuckReason === "insufficient_for_minimums"
                ? t.payoff_stuck_mins
                : t.payoff_stuck_max}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <div className="text-[11px] text-muted-foreground">
                {t.payoff_step1}
              </div>
              <div className="text-lg font-semibold mt-1">
                {monthsLabel(
                  t.payoff_months,
                  result.phase1Months,
                  t.payoff_months_done
                )}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-[11px] text-muted-foreground">
                {t.payoff_step2}
              </div>
              <div className="text-lg font-semibold mt-1">
                {monthsLabel(
                  t.payoff_months,
                  result.phase2Months,
                  t.payoff_months_done
                )}
              </div>
              {result.emergencyFundTarget > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {t.payoff_ef_target}:{" "}
                  {formatCurrency(result.emergencyFundTarget, currency)}
                </div>
              )}
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-[11px] text-muted-foreground">
                {t.payoff_step3}
              </div>
              <div className="text-lg font-semibold mt-1">
                {monthsLabel(
                  t.payoff_months,
                  result.phase3Months,
                  t.payoff_months_done
                )}
              </div>
            </div>
            <div className="rounded-lg border p-3 bg-primary/5">
              <div className="text-[11px] text-muted-foreground">
                {t.payoff_total}
              </div>
              <div className="text-lg font-semibold mt-1">
                {monthsLabel(
                  t.payoff_months,
                  result.totalMonths,
                  t.payoff_months_done
                )}
              </div>
            </div>
          </div>

          {openDebts.length > 0 && Object.keys(result.debtPayoffMonth).length > 0 && (
            <div className="space-y-1 pt-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t.payoff_per_debt}
              </p>
              {openDebts.map((debt) => {
                const m = result.debtPayoffMonth[debt.id];
                if (!m) return null;
                return (
                  <div
                    key={debt.id}
                    className="flex justify-between text-sm gap-2"
                  >
                    <span className="truncate">{debt.name}</span>
                    <span className="text-muted-foreground shrink-0">
                      {t.payoff_payoff_at.replace("{n}", String(m))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
