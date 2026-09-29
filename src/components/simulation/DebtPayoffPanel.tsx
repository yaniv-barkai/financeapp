"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  Plus,
  Save,
  TableProperties,
  X,
} from "lucide-react";
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
  sortDebtsByPayoffOrder,
  toSnowballDebtInput,
} from "@/lib/snowball";
import {
  Debt,
  SnowballOneTimeIncome,
  SnowballPlan,
} from "@/lib/types";
import { projectionMonthEnd, projectionMonthKey } from "@/lib/debt-due";
import { getIntlLocale } from "@/lib/i18n";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PayoffScheduleDialog } from "./PayoffScheduleDialog";
import { PayoffTimeline, type TimelineDebt } from "./PayoffTimeline";

function parsePositive(value: string): number {
  const n = parseFloat(value.replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const ONE_TIME_MONTHS_AHEAD = 60;

/** Projection months offered for one-time money; keeps a past or far-off saved month selectable. */
function monthOptions(selected: number): number[] {
  const months = Array.from({ length: ONE_TIME_MONTHS_AHEAD }, (_, i) => i + 1);
  if (!months.includes(selected)) {
    if (selected < 1) months.unshift(selected);
    else months.push(selected);
  }
  return months;
}

const STEP_COLORS = {
  1: "bg-amber-500",
  2: "bg-emerald-500",
  3: "bg-primary",
} as const;

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
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleFocus, setScheduleFocus] = useState<number | null>(null);

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
      setEfMonthsStr(String(planData.emergencyFundMonths));
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

  const debtsByPayoff = useMemo(
    () => sortDebtsByPayoffOrder(openDebts),
    [openDebts]
  );

  const debtNames = useMemo(
    () => Object.fromEntries(debts.map((d) => [d.id, d.name])),
    [debts]
  );

  const hasSchedule =
    livePlan.nominalMonthlyIncome > 0 && result.schedule.length > 0;

  const openSchedule = (month: number | null) => {
    if (!hasSchedule) return;
    setScheduleFocus(month);
    setScheduleOpen(true);
  };

  const timelineDebts: TimelineDebt[] = useMemo(
    () =>
      debtsByPayoff.map((debt, idx) => ({
        debt,
        order: idx + 1,
        month: result.debtPayoffMonth[debt.id] ?? null,
        interest: result.debtInterest[debt.id] ?? 0,
      })),
    [debtsByPayoff, result]
  );

  const totalDebt = useMemo(
    () => openDebts.reduce((s, d) => s + d.balance, 0),
    [openDebts]
  );

  const debtFreeMonth =
    timelineDebts.length > 0 && timelineDebts.every((d) => d.month !== null)
      ? Math.max(...timelineDebts.map((d) => d.month as number))
      : null;

  const fundMonth =
    result.emergencyFundTarget > 0
      ? (result.schedule.find(
          (e) => e.emergencyFund >= result.emergencyFundTarget - 1e-9
        )?.month ?? null)
      : null;

  const intl = getIntlLocale(locale);
  const monthYearLong = new Intl.DateTimeFormat(intl, {
    month: "long",
    year: "numeric",
  });
  const monthYearShort = new Intl.DateTimeFormat(intl, {
    month: "short",
    year: "numeric",
  });

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
        applyMonth: projectionMonthKey(1),
      },
    ]);
  };

  const updateOneTime = (idx: number, patch: Partial<SnowballOneTimeIncome>) =>
    setOneTimes((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );

  const surplus = livePlan.nominalMonthlyIncome;

  if (loading) {
    return (
      <p className={cn("text-sm text-muted-foreground py-8", align)}>
        {t.payoff_loading}
      </p>
    );
  }

  const money = (n: number) => formatCurrency(n, currency);

  const heroState =
    openDebts.length === 0
      ? "none"
      : surplus <= 0
        ? "no_surplus"
        : result.stuck && result.stuckReason === "insufficient_for_minimums"
          ? "stuck_mins"
          : debtFreeMonth === null
            ? "stuck_max"
            : "ok";

  const p1 = result.phase1Months;
  const p2 = result.phase2Months;
  const p3 = result.phase3Months;
  const e2 = p1 !== null && p2 !== null ? p1 + p2 : null;
  const steps = [
    {
      phase: 1,
      label: t.payoff_step1,
      months: p1,
      start: 0,
      end: p1,
      hasWork: openDebts.some((d) => d.forcePhase1),
    },
    {
      phase: 2,
      label: t.payoff_step2,
      months: p2,
      start: p1,
      end: e2,
      hasWork: result.emergencyFundTarget > 0,
    },
    {
      phase: 3,
      label: t.payoff_step3,
      months: p3,
      start: e2,
      end: e2 !== null && p3 !== null ? e2 + p3 : null,
      hasWork: openDebts.some((d) => !d.forcePhase1),
    },
  ] as const;
  const totalMonths = result.totalMonths ?? 0;
  const showStepBar = !result.stuck && totalMonths > 0;

  const heroCard = (
    <Card className="overflow-hidden border-primary/20 bg-linear-to-br from-primary/10 via-primary/5 to-transparent xl:col-start-1 xl:row-start-1">
      <CardContent className="space-y-5 p-5 sm:p-6">
        {heroState === "ok" && debtFreeMonth !== null ? (
          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-xl bg-primary/15 p-3 text-primary">
              <CalendarCheck className="size-6" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-muted-foreground">
                {t.payoff_free_by}
              </div>
              <div className="mt-0.5 text-2xl font-bold tracking-tight sm:text-3xl">
                {monthYearLong.format(projectionMonthEnd(debtFreeMonth))}
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">
                {t.payoff_free_in.replace("{n}", String(debtFreeMonth))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "shrink-0 rounded-xl p-3",
                heroState === "stuck_mins" || heroState === "stuck_max"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {heroState === "stuck_mins" || heroState === "stuck_max" ? (
                <AlertTriangle className="size-6" />
              ) : (
                <CalendarClock className="size-6" />
              )}
            </div>
            <p
              className={cn(
                "pt-1 text-sm",
                heroState === "stuck_mins" || heroState === "stuck_max"
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              {heroState === "none"
                ? t.payoff_no_debts
                : heroState === "no_surplus"
                  ? t.payoff_no_available
                  : heroState === "stuck_mins"
                    ? t.payoff_stuck_mins
                    : t.payoff_stuck_max}
            </p>
          </div>
        )}

        {openDebts.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-background/70 p-3">
              <div className="text-[11px] text-muted-foreground">
                {t.payoff_debt_now}
              </div>
              <div className="mt-0.5 text-base font-semibold tabular-nums sm:text-lg">
                {money(totalDebt)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {t.payoff_debts_count.replace("{n}", String(openDebts.length))}
              </div>
            </div>
            {heroState === "ok" && (
              <div
                className="rounded-lg bg-background/70 p-3"
                title={t.payoff_total_interest_hint}
              >
                <div className="text-[11px] text-muted-foreground">
                  {t.payoff_total_interest}
                </div>
                <div className="mt-0.5 text-base font-semibold tabular-nums text-red-500 sm:text-lg">
                  {money(result.totalInterest)}
                </div>
              </div>
            )}
            {surplus > 0 && result.emergencyFundTarget > 0 && (
              <div className="rounded-lg bg-background/70 p-3">
                <div className="text-[11px] text-muted-foreground">
                  {t.payoff_ef_target}
                </div>
                <div className="mt-0.5 text-base font-semibold tabular-nums text-emerald-600 sm:text-lg">
                  {money(result.emergencyFundTarget)}
                </div>
                {fundMonth !== null && (
                  <div className="text-[11px] text-muted-foreground">
                    {t.payoff_step_until.replace(
                      "{date}",
                      monthYearShort.format(projectionMonthEnd(fundMonth))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {hasSchedule && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 bg-background/70"
            onClick={() => openSchedule(null)}
          >
            <TableProperties className="h-4 w-4" />
            {t.payoff_schedule_show}
          </Button>
        )}
      </CardContent>
    </Card>
  );

  const settingsCard = (
    <Card className="xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:self-start">
      <CardHeader className="pb-3">
        <CardTitle className={cn("text-base", align)}>
          {t.payoff_settings_title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>{t.payoff_available_monthly}</Label>
          <Input
            inputMode="decimal"
            value={availableStr}
            onChange={(e) => setAvailableStr(e.target.value)}
            placeholder="0"
            className="tabular-nums"
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

        <div className="space-y-1.5 border-t pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="block min-h-8 leading-tight">
                {t.payoff_ef_months}
              </Label>
              <Input
                inputMode="decimal"
                value={efMonthsStr}
                onChange={(e) => setEfMonthsStr(e.target.value)}
                placeholder="3"
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="block min-h-8 leading-tight">
                {t.payoff_ef_income}
              </Label>
              <Input
                inputMode="decimal"
                value={efIncomeStr}
                onChange={(e) => setEfIncomeStr(e.target.value)}
                placeholder="0"
                className="tabular-nums"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t.payoff_ef_months_hint} {t.payoff_ef_income_hint}
          </p>
        </div>

        <div className="space-y-2 border-t pt-4">
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
            <div key={row.id} className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
              <div className="flex items-center gap-2">
                <Input
                  value={row.label}
                  onChange={(e) => updateOneTime(idx, { label: e.target.value })}
                  placeholder={t.payoff_one_time_label_placeholder}
                  aria-label={t.payoff_one_time_label}
                  className="h-8"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground"
                  title={t.payoff_one_time_remove}
                  onClick={() =>
                    setOneTimes((rows) => rows.filter((_, i) => i !== idx))
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">
                    {t.payoff_one_time_amount}
                  </span>
                  <Input
                    inputMode="decimal"
                    defaultValue={row.amount > 0 ? String(row.amount) : ""}
                    onChange={(e) =>
                      updateOneTime(idx, { amount: parsePositive(e.target.value) })
                    }
                    className="h-8 tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">
                    {t.payoff_one_time_month}
                  </span>
                  <Select
                    value={String(row.applyAfterMonths + 1)}
                    onValueChange={(v) => {
                      const projection = Number(v);
                      updateOneTime(idx, {
                        applyAfterMonths: projection - 1,
                        applyMonth: projectionMonthKey(projection),
                      });
                    }}
                    dir={isRtl ? "rtl" : "ltr"}
                  >
                    <SelectTrigger className="h-8 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {monthOptions(row.applyAfterMonths + 1).map((p) => (
                        <SelectItem key={p} value={String(p)}>
                          {monthYearLong.format(projectionMonthEnd(p))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {row.applyAfterMonths < 0 && (
                <p className="text-xs text-amber-600">{t.payoff_one_time_past}</p>
              )}
            </div>
          ))}
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          <Save className="h-4 w-4" />
          {saving ? t.payoff_saving : t.payoff_save_plan}
        </Button>
      </CardContent>
    </Card>
  );

  const stepsCard = surplus > 0 && heroState !== "stuck_mins" && (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className={cn("text-base", align)}>
          {t.payoff_results_title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showStepBar && (
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted">
            {steps.map(
              ({ phase, months }) =>
                (months ?? 0) > 0 && (
                  <div
                    key={phase}
                    className={cn("h-full", STEP_COLORS[phase])}
                    style={{ width: `${((months ?? 0) / totalMonths) * 100}%` }}
                  />
                )
            )}
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          {steps.map(({ phase, label, months, start, end, hasWork }) => {
            const focus =
              hasWork && end !== null && end > 0
                ? Math.min((start ?? 0) + 1, end)
                : null;
            const clickable = hasSchedule && focus !== null;
            return (
              <button
                key={phase}
                type="button"
                disabled={!clickable}
                onClick={() => openSchedule(focus)}
                title={clickable ? t.payoff_schedule_show : undefined}
                className={cn(
                  "rounded-lg border p-3 text-start transition-colors disabled:cursor-default",
                  clickable && "hover:border-primary/50 hover:bg-muted/40",
                  !hasWork && "opacity-60"
                )}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-1 size-2.5 shrink-0 rounded-full",
                      STEP_COLORS[phase]
                    )}
                  />
                  <span className="text-xs leading-snug text-muted-foreground">
                    {label}
                  </span>
                </div>
                <div className="mt-2 text-lg font-semibold">
                  {!hasWork
                    ? t.payoff_step_none
                    : months === null
                      ? "—"
                      : months === 0
                        ? t.payoff_step_same_month
                        : t.payoff_months.replace("{n}", String(months))}
                </div>
                {hasWork && months !== null && end !== null && end > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {t.payoff_step_until.replace(
                      "{date}",
                      monthYearShort.format(projectionMonthEnd(end))
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  const timelineCard = hasSchedule && openDebts.length > 0 && (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className={cn("text-base", align)}>
          {t.payoff_timeline_title}
        </CardTitle>
        <p className={cn("text-xs text-muted-foreground", align)}>
          {t.payoff_timeline_hint} {t.payoff_order_hint}{" "}
          <Link href="/debts" className="text-primary underline-offset-2 hover:underline">
            {t.payoff_order_change}
          </Link>
        </p>
      </CardHeader>
      <CardContent>
        <PayoffTimeline
          debts={timelineDebts}
          fundMonth={fundMonth}
          fundTarget={result.emergencyFundTarget}
          totalDebt={totalDebt}
          debtFreeMonth={debtFreeMonth}
          currency={currency}
          onOpenMonth={openSchedule}
        />
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <p className={cn("text-sm text-muted-foreground", align)}>
        {t.payoff_subtitle}{" "}
        <Link href="/debts" className="text-primary underline-offset-2 hover:underline">
          {t.payoff_manage_debts}
        </Link>
      </p>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:grid-rows-[auto_1fr]">
        {heroCard}
        {settingsCard}
        <div className="min-w-0 space-y-4 xl:col-start-1 xl:row-start-2">
          {timelineCard}
          {stepsCard}
        </div>
      </div>

      <PayoffScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        schedule={result.schedule}
        debtNames={debtNames}
        currency={currency}
        focusMonth={scheduleFocus}
      />
    </div>
  );
}
