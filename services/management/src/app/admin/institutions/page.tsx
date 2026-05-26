"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { canManageInstitutions } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { RowMenu } from "@/components/ui/RowMenu";
import { PaginatedTable } from "@/components/ui/PaginatedTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { apiFetch } from "@/lib/api";
import { listApiUrl, normalizeListResponse } from "@/lib/list-response";
import { useT } from "@/lib/i18n/LocaleProvider";

type Institution = { id: string; code: string; name: string; active: boolean };

export default function InstitutionsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Institution | null>(null);
  const [form, setForm] = useState({ code: "", name: "" });

  useEffect(() => {
    if (session && !canManageInstitutions(session.user?.role)) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  const fetchPage = useCallback(
    async (page: number, pageSize: number) => {
      if (!session?.accessToken) throw new Error("Not signed in");
      const res = await apiFetch(listApiUrl("/api/institutions", page, pageSize), {
        accessToken: session.accessToken,
      });
      if (!res.ok) throw new Error(t("institutions.couldNotLoad"));
      return normalizeListResponse<Institution>(await res.json());
    },
    [session?.accessToken]
  );

  const {
    items: list,
    loading,
    error: listError,
    setError: setListError,
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
    totalPages,
    reload,
  } = usePaginatedList(fetchPage, [session?.accessToken]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;
    setError(null);
    const res = await apiFetch("/api/institutions", {
      method: "POST",
      accessToken: session.accessToken,
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? t("institutions.createFailed"));
      return;
    }
    setCreateOpen(false);
    setForm({ code: "", name: "" });
    await reload();
  }

  return (
    <AppShell title={t("institutions.title")}>
      <PageHeader
        description={t("institutions.description")}
        actions={
          <button
            type="button"
            className="renis-btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            {t("institutions.add")}
          </button>
        }
      />

      {(error ?? listError) ? (
        <Alert variant="error" onDismiss={() => { setError(null); setListError(null); }}>
          {error ?? listError}
        </Alert>
      ) : null}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("institutions.addTitle")}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="renis-btn-secondary"
              onClick={() => setCreateOpen(false)}
            >
              {t("common.cancel")}
            </button>
            <button type="submit" form="institution-create-form" className="renis-btn-primary">
              {t("institutions.create")}
            </button>
          </div>
        }
      >
        <form id="institution-create-form" className="space-y-4" onSubmit={handleCreate}>
          <label className="block text-sm">
            <span className="text-slate-600">{t("institutions.field.code")}</span>
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="renis-input mt-1"
              placeholder={t("institutions.codePlaceholder")}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">{t("institutions.field.name")}</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="renis-input mt-1"
              placeholder={t("institutions.namePlaceholder")}
            />
          </label>
        </form>
      </Modal>

      <Modal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title={detailTarget?.name ?? t("nav.institutions")}
        description={
          detailTarget
            ? `${t("institutions.codeLabel")} ${detailTarget.code}`
            : undefined
        }
        footer={
          detailTarget ? (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="renis-btn-secondary"
                onClick={() => setDetailTarget(null)}
              >
                {t("common.close")}
              </button>
              <button
                type="button"
                className="renis-btn-primary"
                onClick={() =>
                  router.push(`/admin/institutions/${detailTarget.id}/settings`)
                }
              >
                {t("institutions.openSettings")}
              </button>
            </div>
          ) : null
        }
      >
        {detailTarget ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{t("institutions.field.code")}</dt>
              <dd className="font-mono text-slate-900">{detailTarget.code}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("institutions.field.status")}</dt>
              <dd>
                <StatusBadge
                  status={detailTarget.active ? "ACTIVE" : "INACTIVE"}
                />
              </dd>
            </div>
          </dl>
        ) : null}
      </Modal>

      {loading ? (
        <p className="text-slate-500 py-8">{t("common.loading")}</p>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          {t("institutions.empty")}
        </div>
      ) : (
        <PaginatedTable
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        >
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">
                  {t("institutions.field.code")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("institutions.field.name")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("institutions.field.status")}
                </th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {list.map((i) => (
                <tr
                  key={i.id}
                  className="renis-table-row"
                  onClick={() => setDetailTarget(i)}
                >
                  <td className="px-4 py-3 font-mono text-xs">{i.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{i.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={i.active ? "ACTIVE" : "INACTIVE"} />
                  </td>
                  <td className="px-4 py-3">
                    <RowMenu
                      label={t("common.actionsFor", { target: i.code })}
                      items={[
                        {
                          label: t("common.viewDetails"),
                          onClick: () => setDetailTarget(i),
                        },
                        {
                          label: t("institutions.settings"),
                          onClick: () =>
                            router.push(`/admin/institutions/${i.id}/settings`),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PaginatedTable>
      )}
    </AppShell>
  );
}
