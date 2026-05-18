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

const roleLabels: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: "Super Admin",
  [UserRole.MINISTRY_ADMIN]: "Ministry Admin",
  [UserRole.INSTITUTION_ADMIN]: "Institution Admin",
};

function buildNav(role?: UserRole) {
  const items: { href: string; label: string }[] = [
    { href: "/dashboard", label: "Dashboard" },
  ];

  if (canAccessUserManagement(role)) {
    items.push({ href: "/admin/users", label: "User accounts" });
  }
  if (canManageInstitutions(role)) {
    items.push({ href: "/admin/institutions", label: "Institutions" });
    items.push({ href: "/admin/audit", label: "Audit log" });
    items.push({ href: "/admin/diagnostics", label: "Diagnostics" });
  }
  if (canViewMinistryDashboard(role)) {
    items.push({ href: "/ministry", label: "Ministry overview" });
  }
  if (canManageStudents(role)) {
    items.push({ href: "/institution/students", label: "Students" });
  }
  if (canManageGrades(role)) {
    items.push({ href: "/institution/grades", label: "Grades & transcripts" });
    items.push({ href: "/institution/programmes", label: "Programmes" });
  }
  if (canConfigureInstitutionSettings(role)) {
    items.push({
      href: "/institution/settings",
      label: "Institution settings",
    });
  }
  if (canManageDiplomas(role)) {
    items.push({ href: "/institution/diplomas", label: "Diplomas" });
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
  const role = session?.user?.role;
  const nav = buildNav(role);

  useEffect(() => {
    if (session?.error === "RefreshAccessTokenError") {
      void signIn("keycloak", { callbackUrl: window.location.pathname });
    }
  }, [session?.error]);

  if (session?.error === "RefreshAccessTokenError") {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Session expired. Redirecting to sign in…
      </div>
    );
  }

  if (status === "loading" || (status === "authenticated" && !session?.accessToken)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Loading session…
      </div>
    );
  }

  if (!session?.accessToken) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-slate-600">
        <p>Not signed in.</p>
        <Link href="/login" className="text-renis-primary underline">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-renis-primary text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-white/10">
          <p className="font-bold text-lg">RENIS-BI</p>
          <p className="text-xs text-white/70 mt-1">Management</p>
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
            {role ? roleLabels[role] : ""}
          </p>
          <a
            href="/api/auth/federated-logout"
            className="mt-3 inline-block text-xs text-renis-accent hover:underline"
          >
            Sign out
          </a>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <h1 className="text-2xl font-semibold text-slate-800 mb-6">{title}</h1>
        {children}
      </main>
    </div>
  );
}
