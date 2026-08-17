"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { LOCALES, MESSAGES, type Locale, type MessageKey } from "@/lib/i18n";

type I18nValue = { locale: Locale; setLocale: (next: Locale) => void; t: (key: MessageKey) => string };
const I18nContext = createContext<I18nValue>({ locale: "zh-TW", setLocale: () => undefined, t: (key) => MESSAGES["zh-TW"][key] });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh-TW");
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("lang") ?? window.localStorage.getItem("civicpin-locale");
    if (!LOCALES.includes(requested as Locale)) return;
    const frame = window.requestAnimationFrame(() => {
      window.localStorage.setItem("civicpin-locale", requested as Locale);
      setLocaleState(requested as Locale);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo(() => ({
    locale,
    setLocale: (next: Locale) => {
      window.localStorage.setItem("civicpin-locale", next);
      setLocaleState(next);
    },
    t: (key: MessageKey) => MESSAGES[locale][key] ?? MESSAGES["zh-TW"][key],
  }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
