"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

interface PendingConfirm {
  options: Required<ConfirmOptions>;
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((raw) => {
    const opts: Required<ConfirmOptions> =
      typeof raw === "string"
        ? { title: "Confirm", message: raw, confirmLabel: "Confirm", cancelLabel: "Cancel", variant: "destructive" }
        : {
            title: raw.title ?? "Confirm",
            message: raw.message,
            confirmLabel: raw.confirmLabel ?? "Confirm",
            cancelLabel: raw.cancelLabel ?? "Cancel",
            variant: raw.variant ?? "destructive",
          };

    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setPending({ options: opts, resolve });
    });
  }, []);

  const handleResponse = (result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!pending} onOpenChange={(open) => !open && handleResponse(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{pending?.options.title}</DialogTitle>
            {pending?.options.message && (
              <DialogDescription>{pending.options.message}</DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleResponse(false)}>
              {pending?.options.cancelLabel}
            </Button>
            <Button
              variant={pending?.options.variant === "destructive" ? "destructive" : "default"}
              onClick={() => handleResponse(true)}
            >
              {pending?.options.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
