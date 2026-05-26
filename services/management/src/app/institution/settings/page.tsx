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
import { useT } from "@/lib/i18n/LocaleProvider";

export default function MyInstitutionSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const t = useT();
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
      <AppShell title={t("nav.institutionSettings")}>
        <p className="text-slate-500">{t("common.loading")}</p>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("nav.institutionSettings")}>
      {isSuperAdmin && (
        <InstitutionScopeBar onChange={(id) => setInstitutionId(id)} />
      )}

      {!institutionId ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 max-w-lg">
          {isSuperAdmin ? (
            <>
              <p className="mb-3">{t("settings.noScopeSuperAdmin")}</p>
              <p>
                {t("settings.openFromAdmin")}{" "}
                <Link
                  href="/admin/institutions"
                  className="text-renis-primary hover:underline"
                >
                  {t("settings.adminInstitutions")}
                </Link>
                .
              </p>
            </>
          ) : (
            <p>{t("settings.noInstitutionLinked")}</p>
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
