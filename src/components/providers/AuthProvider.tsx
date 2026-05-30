"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserSettings, initUserSettings } from "@/lib/firestore/settings";
import { getBooks, seedDefaultBook } from "@/lib/firestore/books";
import { getCategories } from "@/lib/firestore/categories";
import { getMerchants } from "@/lib/firestore/merchants";
import { reconcileRecurring } from "@/lib/firestore/recurring";
import { useAppStore } from "@/lib/store";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signOutUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { setBooks, setCategories, setMerchants, setActiveBookId, setCurrency, activeBookId } =
    useAppStore();

  useEffect(() => {
    const loadUserData = async (u: User, attempt = 0): Promise<void> => {
      try {
        const settings = await getUserSettings(u.uid);
        const books = await getBooks(u.uid);

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

          reconcileRecurring(u.uid, validBook.id).catch(console.error);
        }
      } catch (err: unknown) {
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
      setUser(u);
      if (u) {
        await loadUserData(u);
      } else {
        setBooks([]);
        setCategories([]);
        setMerchants([]);
        setActiveBookId(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithEmail, signUpWithEmail, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
