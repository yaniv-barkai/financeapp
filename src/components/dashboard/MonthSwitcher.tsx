"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, subMonths } from "date-fns";
import { useAppStore } from "@/lib/store";
import { parseMonthKey, getMonthKey } from "@/lib/utils";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Button } from "@/components/ui/button";

export function MonthSwitcher() {
  const { activeMonth, setActiveMonth } = useAppStore();
  const { locale, t } = useLocale();
  const date = parseMonthKey(activeMonth);
  const isCurrentMonth = activeMonth === getMonthKey(new Date());
  const isRtl = locale === "he";

  const monthLabel = new Intl.DateTimeFormat(isRtl ? "he-IL" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(date);

  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => setActiveMonth(getMonthKey(subMonths(date, 1)))}
      >
        <PrevIcon className="h-4 w-4" />
      </Button>
      <span className="font-semibold text-sm min-w-0 sm:min-w-[120px] text-center truncate">
        {monthLabel}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        disabled={isCurrentMonth}
        onClick={() => setActiveMonth(getMonthKey(addMonths(date, 1)))}
      >
        <NextIcon className="h-4 w-4" />
      </Button>
      {!isCurrentMonth && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => setActiveMonth(getMonthKey(new Date()))}
        >
          {t.month_today}
        </Button>
      )}
    </div>
  );
}
