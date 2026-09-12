"use client";

import React, { createContext, useContext } from "react";
import { useGuide } from "@/lib/hooks/useGuide";
import { GuideItemId } from "@/lib/types";
import type { GuideResult } from "@/lib/guide/evaluate";

interface GuideContextValue {
  result: GuideResult | null;
  loading: boolean;
  refresh: () => void;
  confirmCategories: () => Promise<void>;
  snooze: (itemId: GuideItemId) => Promise<void>;
}

const GuideContext = createContext<GuideContextValue | null>(null);

export function GuideProvider({ children }: { children: React.ReactNode }) {
  const value = useGuide();
  return (
    <GuideContext.Provider value={value}>{children}</GuideContext.Provider>
  );
}

export function useGuideContext(): GuideContextValue {
  const ctx = useContext(GuideContext);
  if (!ctx) {
    throw new Error("useGuideContext must be used within GuideProvider");
  }
  return ctx;
}
