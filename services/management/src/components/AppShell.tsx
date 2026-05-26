"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useEffect } from "react";
import { UserRole } from "@renis/core/roles";
import {
  canAccessUserManagement,
  canManageInstitutions,
  canConfigureInstitutionSettings,
  canManageDiplomas,
  canManageGrades,
  canManageStudents,
  canViewMinistryDashboard,
} from "@renis/core/permissions";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { TranslationKey } from "@/lib/i18n";

const roleLabelKey: Record<UserRole, TranslationKey> = {
  [UserRole.SUPER_ADMIN]: "role.SUPER_ADMIN",
  [UserRole.MINISTRY_ADMIN]: "role.MINISTRY_ADMIN",
  [UserRole.INSTITUTION_ADMIN]: "role.INSTITUTION_ADMIN",
};

function buildNav(role: UserRole | undefined, t: ReturnType<typeof useT>) {
  const items: { href: string; label: string }[] = [
    { href: "/dashboard", label: t("nav.dashboard") },
  ];

  if (canAccessUserManagement(role)) {
    items.push({ href: "/admin/users", label: t("nav.userAccounts") });
  }
  if (canManageInstitutions(role)) {
    items.push({ href: "/admin/institutions", label: t("nav.institutions") });
    items.push({ href: "/admin/audit", label: t("nav.auditLog") });
    items.push({ href: "/admin/diagnostics", label: t("nav.diagnostics") });
  }
  if (canViewMinistryDashboard(role)) {
    items.push({ href: "/ministry", label: t("nav.ministryOverview") });
  }
  if (canManageStudents(role)) {
    items.push({ href: "/institution/students", label: t("nav.students") });
  }
  if (canManageGrades(role)) {
    items.push({
      href: "/institution/grades",
      label: t("nav.gradesTranscripts"),
    });
    items.push({
      href: "/institution/programmes",
      label: t("nav.programmes"),
    });
  }
  if (canConfigureInstitutionSettings(role)) {
    items.push({
      href: "/institution/settings",
      label: t("nav.institutionSettings"),
    });
  }
  if (canManageDiplomas(role)) {
    items.push({ href: "/institution/diplomas", label: t("nav.diplomas") });
  }

  return items;
}

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const { data: session, status } = useSession();
  const t = useT();
  const role = session?.user?.role;
  const nav = buildNav(role, t);

  useEffect(() => {
    if (session?.error === "RefreshAccessTokenError") {
      void signIn("keycloak", { callbackUrl: window.location.pathname });
    }
  }, [session?.error]);

  if (session?.error === "RefreshAccessTokenError") {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        {t("common.sessionExpired")}
      </div>
    );
  }

  if (status === "loading" || (status === "authenticated" && !session?.accessToken)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        {t("common.loadingSession")}
      </div>
    );
  }

  if (!session?.accessToken) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-slate-600">
        <p>{t("common.notSignedIn")}</p>
        <Link href="/login" className="text-renis-primary underline">
          {t("common.goToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-renis-primary text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-white/10">
          <p className="font-bold text-lg">{t("common.app.brand")}</p>
          <p className="text-xs text-white/70 mt-1">
            {t("common.app.subtitle")}
          </p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm hover:bg-white/10 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 text-sm">
          <p className="truncate">{session?.user?.email}</p>
          <p className="text-white/60 text-xs mt-1">
            {role ? t(roleLabelKey[role]) : ""}
          </p>
          <a
            href="/api/auth/federated-logout"
            className="mt-3 inline-block text-xs text-renis-accent hover:underline"
          >
            {t("common.signOut")}
          </a>
        </div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-8 py-3">
          <LanguageSwitcher variant="inline" />
        </header>
        <div className="flex-1 p-8 overflow-auto">
          <h1 className="text-2xl font-semibold text-slate-800 mb-6">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}
