"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { TransactionForm } from "./TransactionForm";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function QuickAddFab() {
  const [open, setOpen] = useState(false);
  const { t } = useLocale();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 end-4 z-50 sm:bottom-6 sm:end-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
        aria-label={t.fab_add_transaction}
      >
        <Plus className="h-6 w-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.form_add_title}</DialogTitle>
          </DialogHeader>
          <TransactionForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
