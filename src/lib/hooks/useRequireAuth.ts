"use client";

import { useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

export function useRequireAuth() {
  const { user, loading, accountBlocked, signOutUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      startTransition(() => {
        router.replace("/login");
      });
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user && accountBlocked) {
      startTransition(() => {
        router.replace("/login");
      });
    }
  }, [user, loading, accountBlocked, router]);

  return { user, loading: loading || Boolean(user && accountBlocked), accountBlocked, signOutUser };
}
