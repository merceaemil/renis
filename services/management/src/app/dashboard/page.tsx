"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { UserRole } from "@renis/core/roles";
import {
  canAccessUserManagement,
  canManageInstitutions,
  canManageDiplomas,
  canManageGrades,
  canManageStudents,
  canViewMinistryDashboard,
} from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { TranslationKey } from "@/lib/i18n";

export default function DashboardPage() {
  const { data: session } = useSession();
  const t = useT();
  const role = session?.user?.role;

  const cards: {
    href: string;
    titleKey: TranslationKey;
    descKey: TranslationKey;
    show: boolean;
  }[] = [
    {
      href: "/admin/users",
      titleKey: "nav.userAccounts",
      descKey: "dashboard.card.users.description",
      show: canAccessUserManagement(role),
    },
    {
      href: "/admin/institutions",
      titleKey: "nav.institutions",
      descKey: "dashboard.card.institutions.description",
      show: canManageInstitutions(role),
    },
    {
      href: "/ministry",
      titleKey: "nav.ministryOverview",
      descKey: "dashboard.card.ministry.description",
      show: canViewMinistryDashboard(role),
    },
    {
      href: "/institution/students",
      titleKey: "nav.students",
      descKey: "dashboard.card.students.description",
      show: canManageStudents(role),
    },
    {
      href: "/institution/grades",
      titleKey: "nav.gradesTranscripts",
      descKey: "dashboard.card.grades.description",
      show: canManageGrades(role),
    },
    {
      href: "/institution/programmes",
      titleKey: "nav.programmes",
      descKey: "dashboard.card.programmes.description",
      show: canManageGrades(role),
    },
    {
      href: "/institution/diplomas",
      titleKey: "nav.diplomas",
      descKey: "dashboard.card.diplomas.description",
      show: canManageDiplomas(role),
    },
  ];

  const roleWelcomeKey: TranslationKey | null =
    role === UserRole.SUPER_ADMIN
      ? "dashboard.welcome.SUPER_ADMIN"
      : role === UserRole.MINISTRY_ADMIN
      ? "dashboard.welcome.MINISTRY_ADMIN"
      : role === UserRole.INSTITUTION_ADMIN
      ? "dashboard.welcome.INSTITUTION_ADMIN"
      : null;

  return (
    <AppShell title={t("dashboard.title")}>
      <p className="text-slate-600 mb-6">
        {t("dashboard.welcome")}
        {session?.user?.email ? `, ${session.user.email}` : ""}.
        {roleWelcomeKey ? ` ${t(roleWelcomeKey)}` : ""}
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards
          .filter((c) => c.show)
          .map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-renis-primary transition-colors"
            >
              <h2 className="font-semibold text-renis-primary">
                {t(card.titleKey)}
              </h2>
              <p className="mt-2 text-sm text-slate-600">{t(card.descKey)}</p>
            </Link>
          ))}
      </div>
    </AppShell>
  );
}
