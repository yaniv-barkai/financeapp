"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useGuideContext } from "@/components/providers/GuideProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { guideItemReason, guideItemTitle } from "@/lib/guide/copy";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function GuideBell() {
  const { t } = useLocale();
  const { result, snooze } = useGuideContext();
  const count = result?.badgeCount ?? 0;
  const items = result?.allItems ?? [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          title={t.guide_bell_title}
          aria-label={t.guide_bell_title}
        >
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(20rem,calc(100vw-1.5rem))] p-0"
      >
        <div className="border-b px-3 py-2">
          <p className="text-sm font-semibold">{t.guide_bell_title}</p>
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            {t.guide_bell_empty}
          </p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {items.map((item) => (
              <li key={item.id} className="px-3 py-2.5">
                <Link
                  href={item.href}
                  className="block space-y-0.5 hover:opacity-90"
                >
                  <p
                    className={cn(
                      "text-sm font-medium",
                      item.severity === "warning" && "text-amber-700 dark:text-amber-400"
                    )}
                  >
                    {guideItemTitle(t, item)}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {guideItemReason(t, item)}
                  </p>
                </Link>
                <button
                  type="button"
                  className="mt-1 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => snooze(item.id)}
                >
                  {t.guide_dismiss_snooze}
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
