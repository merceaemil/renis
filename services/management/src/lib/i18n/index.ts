import {
  DEFAULT_LOCALE,
  type Locale,
  SUPPORTED_LOCALES,
  isLocale,
  normalizeLocale,
  parseAcceptLanguage,
} from "@renis/core/i18n";
import en, { type TranslationKey } from "./translations/en";
import fr from "./translations/fr";

export const LOCALE_COOKIE = "renis-locale";
export const LOCALE_STORAGE_KEY = "renis-locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const messages: Record<Locale, Record<TranslationKey, string>> = {
  en,
  fr,
};

export {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isLocale,
  normalizeLocale,
  parseAcceptLanguage,
};
export type { Locale, TranslationKey };

export function translate(
  key: TranslationKey,
  locale: Locale = DEFAULT_LOCALE,
  vars?: Record<string, string | number>
): string {
  const localeMsg = messages[locale]?.[key];
  const fallback = messages[DEFAULT_LOCALE]?.[key];
  const template = localeMsg ?? fallback ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = vars[name];
    return v === undefined || v === null ? `{${name}}` : String(v);
  });
}
