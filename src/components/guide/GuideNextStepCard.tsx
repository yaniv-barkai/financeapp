"use client";

import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { GuideItem } from "@/lib/types";
import { useLocale } from "@/components/providers/LocaleProvider";
import { guideItemReason, guideItemTitle } from "@/lib/guide/copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  item: GuideItem;
  heading?: "next" | "attention";
  onSnooze?: (item: GuideItem) => void;
  className?: string;
}

export function GuideNextStepCard({
  item,
  heading = "next",
  onSnooze,
  className,
}: Props) {
  const { t } = useLocale();
  const title = guideItemTitle(t, item);
  const reason = guideItemReason(t, item);

  return (
    <Card
      className={cn(
        "border-primary/20 bg-primary/5",
        item.severity === "warning" && "border-amber-500/30 bg-amber-500/5",
        className
      )}
    >
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {heading === "attention" ? t.guide_needs_attention : t.guide_next_step}
          </p>
          <p className="font-semibold leading-snug">{title}</p>
          <p className="text-sm text-muted-foreground">{reason}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {onSnooze && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => onSnooze(item)}
            >
              <Clock className="h-3.5 w-3.5" />
              {t.guide_dismiss_snooze}
            </Button>
          )}
          <Button asChild size="sm" className="gap-1.5">
            <Link href={item.href}>
              {t.guide_cta}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
