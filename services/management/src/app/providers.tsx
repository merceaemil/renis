"use client";

import { SessionProvider } from "next-auth/react";
import type { Locale } from "@/lib/i18n";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

export function Providers({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  return (
    <SessionProvider
      refetchInterval={4 * 60}
      refetchOnWindowFocus
    >
      <LocaleProvider initialLocale={initialLocale}>{children}</LocaleProvider>
    </SessionProvider>
  );
}
