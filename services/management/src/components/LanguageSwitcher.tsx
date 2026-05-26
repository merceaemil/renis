"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n";

const LABELS: Record<Locale, string> = {
  en: "EN",
  fr: "FR",
};

type LanguageSwitcherProps = {
  variant?: "sidebar" | "inline";
  className?: string;
};

/**
 * Compact language selector. Two visual variants:
 *   - `sidebar` — dark background, used in the management AppShell sidebar.
 *   - `inline`  — light/transparent, used on public pages and the login form.
 */
export function LanguageSwitcher({
  variant = "inline",
  className = "",
}: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useLocale();

  const baseGroup =
    variant === "sidebar"
      ? "inline-flex rounded-md border border-white/15 bg-white/5 p-0.5 text-xs"
      : "inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs shadow-sm";

  const buttonBase = "px-2 py-1 rounded font-medium transition-colors";
  const activeCls =
    variant === "sidebar"
      ? "bg-white/15 text-white"
      : "bg-renis-primary text-white";
  const inactiveCls =
    variant === "sidebar"
      ? "text-white/70 hover:text-white"
      : "text-slate-600 hover:text-renis-primary";

  return (
    <div
      className={`${baseGroup} ${className}`}
      role="group"
      aria-label={t("lang.label")}
    >
      {SUPPORTED_LOCALES.map((code) => {
        const isActive = code === locale;
        return (
          <button
            key={code}
            type="button"
            className={`${buttonBase} ${isActive ? activeCls : inactiveCls}`}
            aria-pressed={isActive}
            onClick={() => setLocale(code)}
          >
            {LABELS[code]}
          </button>
        );
      })}
    </div>
  );
}
