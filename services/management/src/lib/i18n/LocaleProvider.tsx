"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_STORAGE_KEY,
  isLocale,
  type Locale,
  translate,
  type TranslationKey,
} from "./index";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (
    key: TranslationKey,
    vars?: Record<string, string | number>
  ) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readInitialLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage?.getItem(LOCALE_STORAGE_KEY);
    if (stored && isLocale(stored)) return stored;
  } catch {}
  const cookieMatch = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${LOCALE_COOKIE}=`));
  if (cookieMatch) {
    const value = decodeURIComponent(cookieMatch.split("=")[1] ?? "");
    if (isLocale(value)) return value;
  }
  return DEFAULT_LOCALE;
}

function persistLocale(locale: Locale): void {
  if (typeof document === "undefined") return;
  try {
    window.localStorage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {}
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(
    locale
  )}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
  if (document.documentElement) {
    document.documentElement.lang = locale;
  }
}

export function LocaleProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Hydrate from localStorage/cookie after mount so SSR markup stays stable.
  useEffect(() => {
    const detected = readInitialLocale();
    if (detected !== locale) {
      setLocaleState(detected);
    }
    if (document.documentElement) {
      document.documentElement.lang = detected;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => translate(key, locale, vars),
    }),
    [locale, setLocale]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // Fallback so components rendered outside the provider still work.
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key, vars) => translate(key, DEFAULT_LOCALE, vars),
    };
  }
  return ctx;
}

export function useT() {
  return useLocale().t;
}
