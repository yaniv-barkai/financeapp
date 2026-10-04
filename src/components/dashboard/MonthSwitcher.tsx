"use client";

import React, { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { parseMonthKey, getMonthRange, getPeriodKey, getPrevMonthKey, getNextMonthKey } from "@/lib/utils";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Button } from "@/components/ui/button";

export function MonthSwitcher() {
  const { activeMonth, setActiveMonth, monthStartDay } = useAppStore();
  const { locale, t } = useLocale();
  const date = parseMonthKey(activeMonth);
  const currentKey = getPeriodKey(new Date(), monthStartDay);
  const isCurrentMonth = activeMonth >= currentKey;
  const isRtl = locale === "he";
  const intlLocale = isRtl ? "he-IL" : "en-US";

  useEffect(() => {
    if (activeMonth > currentKey) setActiveMonth(currentKey);
  }, [activeMonth, currentKey, setActiveMonth]);

  const monthLabel = new Intl.DateTimeFormat(intlLocale, {
    month: "long",
    year: "numeric",
  }).format(date);

  let rangeLabel: string | null = null;
  if (monthStartDay > 1) {
    const { start, end } = getMonthRange(activeMonth, monthStartDay);
    const fmt = new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short" });
    rangeLabel = `${fmt.format(start)} – ${fmt.format(end)}`;
  }

  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => setActiveMonth(getPrevMonthKey(activeMonth))}
      >
        <PrevIcon className="h-4 w-4" />
      </Button>
      <span className="min-w-0 sm:min-w-[120px] text-center">
        <span className="block font-semibold text-sm truncate">{monthLabel}</span>
        {rangeLabel && (
          <span className="block text-xs text-muted-foreground truncate">{rangeLabel}</span>
        )}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        disabled={isCurrentMonth}
        onClick={() => setActiveMonth(getNextMonthKey(activeMonth))}
      >
        <NextIcon className="h-4 w-4" />
      </Button>
      {activeMonth !== currentKey && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => setActiveMonth(currentKey)}
        >
          {t.month_today}
        </Button>
      )}
    </div>
  );
}
