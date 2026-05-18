"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { canManageInstitutions } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import { InstitutionSettingsForm } from "@/components/InstitutionSettingsForm";

export default function InstitutionSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session && !canManageInstitutions(session.user?.role)) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  if (!session?.accessToken) {
    return (
      <AppShell title="Institution settings">
        <p className="text-slate-500">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Institution settings">
      <InstitutionSettingsForm
        institutionId={id}
        accessToken={session.accessToken}
        backHref="/admin/institutions"
      />
    </AppShell>
  );
}
