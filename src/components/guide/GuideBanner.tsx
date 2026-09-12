"use client";

import Link from "next/link";
import { GuideItem } from "@/lib/types";
import { useLocale } from "@/components/providers/LocaleProvider";
import { cn } from "@/lib/utils";

interface Props {
  message: string;
  href?: string;
  cta?: string;
  severity?: GuideItem["severity"];
  className?: string;
}

export function GuideBanner({
  message,
  href,
  cta,
  severity = "info",
  className,
}: Props) {
  const { t } = useLocale();
  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
        severity === "warning"
          ? "border-amber-500/30 bg-amber-500/5 text-amber-950 dark:text-amber-100"
          : "border-primary/20 bg-primary/5",
        className
      )}
    >
      <p className="min-w-0 flex-1">{message}</p>
      {href && (
        <Link
          href={href}
          className="shrink-0 font-medium text-primary underline-offset-2 hover:underline"
        >
          {cta ?? t.guide_cta}
        </Link>
      )}
    </div>
  );
}
