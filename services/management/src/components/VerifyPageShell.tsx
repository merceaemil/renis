"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n/LocaleProvider";

export function VerifyPageShell({
  children,
  subtitle,
}: {
  children: ReactNode;
  subtitle?: string;
}) {
  const t = useT();
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-renis-primary via-slate-800 to-slate-900">
      <header className="px-4 pt-8 pb-4 text-center text-white relative">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher variant="sidebar" />
        </div>
        <p className="text-xs font-medium uppercase tracking-widest text-renis-accent">
          {t("verify.country")}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {t("common.app.brand")}
        </h1>
        <p className="mt-1 text-sm text-slate-300 max-w-md mx-auto">
          {subtitle ?? t("verify.tagline")}
        </p>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 pb-12">
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 sm:p-8 shadow-2xl ring-1 ring-slate-200/80">
          {children}
        </div>
      </main>

      <footer className="px-4 pb-6 text-center text-xs text-slate-400">
        <p>{t("verify.footer")}</p>
        <p className="mt-2">
          <Link href="/verify" className="text-renis-accent hover:underline">
            {t("verify.verifyAnother")}
          </Link>
          {" · "}
          <Link href="/login" className="text-slate-400 hover:text-white">
            {t("verify.adminLogin")}
          </Link>
        </p>
      </footer>
    </div>
  );
}
