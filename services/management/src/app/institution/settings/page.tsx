"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { UserRole } from "@renis/core/roles";
import { canConfigureInstitutionSettings } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import {
  InstitutionScopeBar,
  readScopedInstitutionId,
} from "@/components/InstitutionScopeBar";
import { InstitutionSettingsForm } from "@/components/InstitutionSettingsForm";
import { apiFetch } from "@/lib/api";

export default function MyInstitutionSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [institutionId, setInstitutionId] = useState("");

  const isSuperAdmin = session?.user?.role === UserRole.SUPER_ADMIN;

  useEffect(() => {
    if (session && !canConfigureInstitutionSettings(session.user?.role)) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  useEffect(() => {
    if (!session?.accessToken || isSuperAdmin) return;
    void (async () => {
      const res = await apiFetch("/api/me", { accessToken: session.accessToken });
      if (!res.ok) return;
      const me = await res.json();
      if (me.institutionId) setInstitutionId(me.institutionId);
    })();
  }, [session?.accessToken, isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin) {
      setInstitutionId(readScopedInstitutionId());
    }
  }, [isSuperAdmin]);

  if (!session?.accessToken) {
    return (
      <AppShell title="Institution settings">
        <p className="text-slate-500">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Institution settings">
      {isSuperAdmin && (
        <InstitutionScopeBar onChange={(id) => setInstitutionId(id)} />
      )}

      {!institutionId ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 max-w-lg">
          {isSuperAdmin ? (
            <>
              <p className="mb-3">
                Choose an institution in the scope selector above to edit its
                grade classifications and branding.
              </p>
              <p>
                Or open settings from{" "}
                <Link
                  href="/admin/institutions"
                  className="text-renis-primary hover:underline"
                >
                  Admin → Institutions
                </Link>
                .
              </p>
            </>
          ) : (
            <p>
              Your account is not linked to an institution. Contact a Super
              Admin.
            </p>
          )}
        </div>
      ) : (
        <InstitutionSettingsForm
          institutionId={institutionId}
          accessToken={session.accessToken}
          backHref="/dashboard"
        />
      )}
    </AppShell>
  );
}
