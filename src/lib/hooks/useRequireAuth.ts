"use client";

import { useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

export function useRequireAuth() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      startTransition(() => {
        router.replace("/login");
      });
    }
  }, [user, loading]);

  return { user, loading };
}
