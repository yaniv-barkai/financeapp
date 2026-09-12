"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserSettings, initUserSettings } from "@/lib/firestore/settings";
import { getBooks, seedDefaultBook } from "@/lib/firestore/books";
import { getCategories } from "@/lib/firestore/categories";
import { getMerchants } from "@/lib/firestore/merchants";
import { useAppStore, setStoreUserId, clearUserSession } from "@/lib/store";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  accountBlocked: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isAdmin: false,
  accountBlocked: false,
  signInWithEmail: async () => {},
  signOutUser: async () => {},
  refreshClaims: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accountBlocked, setAccountBlocked] = useState(false);
  const { setBooks, setCategories, setMerchants, setActiveBookId, setCurrency, activeBookId } =
    useAppStore();

  const refreshClaims = async () => {
    const current = auth.currentUser;
    if (!current) {
      setIsAdmin(false);
      return;
    }
    const tokenResult = await current.getIdTokenResult(true);
    setIsAdmin(tokenResult.claims.admin === true);
  };

  useEffect(() => {
    const loadUserData = async (u: User, attempt = 0): Promise<void> => {
      try {
        const settings = await getUserSettings(u.uid);
        const books = await getBooks(u.uid);
        setAccountBlocked(false);

        if (books.length === 0) {
          const bookId = await seedDefaultBook(u.uid);
          await initUserSettings(u.uid, bookId);
          const newBooks = await getBooks(u.uid);
          setBooks(newBooks);
          setActiveBookId(bookId);
          setCurrency("USD");
        } else {
          setBooks(books);
          const preferredBookId = activeBookId ?? settings?.defaultBookId ?? books[0].id;
          const validBook = books.find((b) => b.id === preferredBookId) ?? books[0];
          setActiveBookId(validBook.id);
          if (settings?.currency) setCurrency(settings.currency);

          const cats = await getCategories(u.uid, validBook.id);
          setCategories(cats);
          const merchants = await getMerchants(u.uid, validBook.id);
          setMerchants(merchants);
        }
      } catch (err: unknown) {
        const code = (err as { code?: string }).code ?? "";
        const message = err instanceof Error ? err.message : "";
        const isPermission =
          code === "permission-denied" ||
          message.includes("permission-denied") ||
          message.includes("Missing or insufficient permissions");
        if (isPermission) {
          setAccountBlocked(true);
          return;
        }
        const isOffline =
          err instanceof Error && err.message.includes("client is offline");
        if (isOffline && attempt < 4) {
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          return loadUserData(u, attempt + 1);
        }
        console.error("Error loading user data:", err);
      }
    };

    const unsub = onAuthStateChanged(auth, async (u) => {
      setStoreUserId(u?.uid ?? null);

      if (u) {
        clearUserSession();
        await useAppStore.persist.rehydrate();
        const tokenResult = await u.getIdTokenResult();
        setIsAdmin(tokenResult.claims.admin === true);
      } else {
        setIsAdmin(false);
        setAccountBlocked(false);
      }

      setUser(u);
      if (u) {
        await loadUserData(u);
      } else {
        clearUserSession();
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        accountBlocked,
        signInWithEmail,
        signOutUser,
        refreshClaims,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
