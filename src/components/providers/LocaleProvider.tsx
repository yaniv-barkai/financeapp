"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Locale, Translations, translations, setModuleLocale } from "@/lib/i18n";

interface LocaleContextValue {
  locale: Locale;
  t: Translations;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  t: translations.en,
  setLocale: () => {},
});

const STORAGE_KEY = "finance_app_locale";

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored === "en" || stored === "he") {
      setLocaleState(stored);
      setModuleLocale(stored);
    }
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = locale === "he" ? "he" : "en";
    html.dir = locale === "he" ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    setModuleLocale(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <LocaleContext.Provider value={{ locale, t: translations[locale], setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
