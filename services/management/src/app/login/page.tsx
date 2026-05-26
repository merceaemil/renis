"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLocale, useT } from "@/lib/i18n/LocaleProvider";
import type { TranslationKey } from "@/lib/i18n";

const ERROR_KEYS: Record<string, TranslationKey> = {
  Configuration: "login.error.Configuration",
  AccessDenied: "login.error.AccessDenied",
  OAuthSignin: "login.error.OAuthSignin",
  OAuthCallback: "login.error.OAuthCallback",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const t = useT();
  const { locale } = useLocale();

  const errorKey: TranslationKey =
    (error ? ERROR_KEYS[error] : undefined) ?? "login.error.Default";

  const resetCredentialsUrl = (() => {
    const issuer =
      process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER ??
      "http://localhost:8080/realms/renis";
    const clientId =
      process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "renis-management";
    const params = new URLSearchParams({
      client_id: clientId,
      kc_locale: locale,
      ui_locales: locale,
    });
    return `${issuer}/login-actions/reset-credentials?${params.toString()}`;
  })();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-renis-primary to-slate-800 px-4">
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher variant="inline" />
      </div>
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-renis-primary">
            {t("common.app.brand")}
          </h1>
          <p className="mt-2 text-sm text-slate-600">{t("login.tagline")}</p>
        </div>

        {error && (
          <div
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {t(errorKey)}
          </div>
        )}

        <p className="mb-6 text-center text-sm text-slate-500">
          {t("login.intro")}
        </p>
        <button
          type="button"
          onClick={() =>
            signIn(
              "keycloak",
              { callbackUrl },
              { kc_locale: locale, ui_locales: locale }
            )
          }
          className="w-full rounded-lg bg-renis-primary px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          {t("login.button")}
        </button>
        <p className="mt-3 text-center text-sm">
          <a
            href={resetCredentialsUrl}
            className="text-renis-primary hover:underline"
          >
            {t("login.forgot")}
          </a>
        </p>
        <p className="mt-4 text-center text-xs text-slate-400">
          {t("login.devHint")}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-white">
          …
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
