"use client";

import React, { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Transaction } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { CategoryPicker } from "@/components/transactions/CategoryPicker";

/** Icon + label that open one shared category picker (good tap targets on mobile). */
export function TransactionCategoryControls({
  tx,
  catIcon,
  catLabel,
  onChange,
  tagsSlot,
  note,
}: {
  tx: Transaction;
  catIcon: string;
  catLabel: string;
  onChange: (categoryId: string) => void;
  tagsSlot?: React.ReactNode;
  note?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xl w-10 h-10 flex-shrink-0 inline-flex items-center justify-center rounded-md hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={catLabel}
      >
        {catIcon}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {tx.merchantDisplay || catLabel}
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded px-1 py-0.5 -mx-1 min-h-[28px] inline-flex items-center hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {catLabel}
          </button>
          <span>·</span>
          <span>{formatDate(tx.date.toDate())}</span>
          {tx.recurringId && (
            <span className="inline-flex items-center gap-0.5 ms-0.5">
              · <RefreshCw className="h-3 w-3 inline" />
            </span>
          )}
        </p>
        {tagsSlot}
        {note && <p className="text-xs text-muted-foreground italic truncate">{note}</p>}
      </div>
      <CategoryPicker
        value={tx.categoryId}
        onChange={(id) => {
          onChange(id);
          setOpen(false);
        }}
        typeFilter={tx.type}
        open={open}
        onOpenChange={setOpen}
        hideTrigger
      />
    </>
  );
}
