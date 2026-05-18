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

export default function DashboardPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  const cards: { href: string; title: string; description: string; show: boolean }[] =
    [
      {
        href: "/admin/users",
        title: "User accounts",
        description: "Create and manage administrator accounts (Keycloak + RENIS).",
        show: canAccessUserManagement(role),
      },
      {
        href: "/admin/institutions",
        title: "Institutions",
        description: "Register universities and higher education institutions.",
        show: canManageInstitutions(role),
      },
      {
        href: "/ministry",
        title: "Ministry overview",
        description: "Read-only national view of submitted grades and published diplomas.",
        show: canViewMinistryDashboard(role),
      },
      {
        href: "/institution/students",
        title: "Students",
        description: "Manage students (all institutions for Super Admin).",
        show: canManageStudents(role),
      },
      {
        href: "/institution/grades",
        title: "Grades & transcripts",
        description: "Grade sessions and transcripts across institutions you can access.",
        show: canManageGrades(role),
      },
      {
        href: "/institution/programmes",
        title: "Programmes",
        description: "Study programmes and subjects for grade sessions.",
        show: canManageGrades(role),
      },
      {
        href: "/institution/diplomas",
        title: "Diplomas",
        description: "Diploma workflow and public verification codes.",
        show: canManageDiplomas(role),
      },
    ];

  return (
    <AppShell title="Dashboard">
      <p className="text-slate-600 mb-6">
        Welcome{session?.user?.email ? `, ${session.user.email}` : ""}.
        {role === UserRole.SUPER_ADMIN &&
          " You have full access across all institutions and ministry views."}
        {role === UserRole.MINISTRY_ADMIN &&
          " You have read-only access across all institutions."}
        {role === UserRole.INSTITUTION_ADMIN &&
          " You manage data for your institution only."}
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
              <h2 className="font-semibold text-renis-primary">{card.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{card.description}</p>
            </Link>
          ))}
      </div>
    </AppShell>
  );
}
