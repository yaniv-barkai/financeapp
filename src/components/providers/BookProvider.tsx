"use client";

import React, { useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { useAppStore } from "@/lib/store";
import { getCategories } from "@/lib/firestore/categories";
import { getMerchants } from "@/lib/firestore/merchants";
import { getTags } from "@/lib/firestore/tags";
import { reconcileRecurring } from "@/lib/firestore/recurring";

export function BookProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeBookId, setCategories, setMerchants, setTags } = useAppStore();

  useEffect(() => {
    if (!user || !activeBookId) return;
    let cancelled = false;

    const load = async (attempt = 0): Promise<void> => {
      try {
        const [cats, merchants, tags] = await Promise.all([
          getCategories(user.uid, activeBookId),
          getMerchants(user.uid, activeBookId),
          getTags(user.uid, activeBookId),
        ]);
        if (!cancelled) {
          setCategories(cats);
          setMerchants(merchants);
          setTags(tags);
          reconcileRecurring(user.uid, activeBookId).catch(console.error);
        }
      } catch (err: unknown) {
        const isOffline = err instanceof Error && err.message.includes("client is offline");
        if (isOffline && attempt < 4 && !cancelled) {
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          return load(attempt + 1);
        }
        console.error("Error loading book data:", err);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user, activeBookId]);

  return <>{children}</>;
}
