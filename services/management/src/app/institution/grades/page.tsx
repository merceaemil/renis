"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { canManageGrades } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import { InstitutionScopeBar } from "@/components/InstitutionScopeBar";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaginatedTable } from "@/components/ui/PaginatedTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { withInstitutionQuery } from "@/lib/api-scope-query";
import { apiFetch } from "@/lib/api";
import { listApiUrl, normalizeListResponse } from "@/lib/list-response";
import { useT } from "@/lib/i18n/LocaleProvider";

type Programme = { id: string; code: string; name: string };
type GradeSession = {
  id: string;
  academicYear: string;
  semester: string;
  status: string;
  submittedAt: string | null;
  programme: Programme;
  _count: { grades: number };
};

export default function GradesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const t = useT();
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [scopeId, setScopeId] = useState("");
  const [form, setForm] = useState({
    programmeId: "",
    academicYear: "2024-2025",
    semester: "S1",
  });

  useEffect(() => {
    if (session && !canManageGrades(session.user?.role)) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  const fetchPage = useCallback(
    async (page: number, pageSize: number) => {
      if (!session?.accessToken) throw new Error("Not signed in");
      const url = withInstitutionQuery(
        listApiUrl("/api/grade-sessions", page, pageSize),
        scopeId
      );
      const res = await apiFetch(url, { accessToken: session.accessToken });
      if (!res.ok) throw new Error(t("grades.couldNotLoad"));
      return normalizeListResponse<GradeSession>(await res.json());
    },
    [session?.accessToken, scopeId]
  );

  const {
    items: sessions,
    loading,
    error,
    setError,
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
    totalPages,
  } = usePaginatedList(fetchPage, [scopeId, session?.accessToken]);

  useEffect(() => {
    if (!session?.accessToken) return;
    void (async () => {
      const url = withInstitutionQuery("/api/programmes?all=true", scopeId);
      const res = await apiFetch(url, { accessToken: session.accessToken });
      if (res.ok) {
        const data = normalizeListResponse<Programme>(await res.json());
        setProgrammes(data.items);
      }
    })();
  }, [session?.accessToken, scopeId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;
    setError(null);
    const res = await apiFetch("/api/grade-sessions", {
      method: "POST",
      accessToken: session.accessToken,
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? t("grades.creationFailed"));
      return;
    }
    setCreateOpen(false);
    router.push(`/institution/grades/${data.id}`);
  }

  return (
    <AppShell title={t("grades.title")}>
      <InstitutionScopeBar onChange={setScopeId} />

      <PageHeader
        description={t("grades.description")}
        actions={
          <button
            type="button"
            className="renis-btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            {t("grades.newSession")}
          </button>
        }
      />

      {error ? (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("grades.newSessionTitle")}
        description={t("grades.newSessionHint")}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="renis-btn-secondary"
              onClick={() => setCreateOpen(false)}
            >
              {t("common.cancel")}
            </button>
            <button type="submit" form="grade-session-form" className="renis-btn-primary">
              {t("grades.createOpen")}
            </button>
          </div>
        }
      >
        <form id="grade-session-form" className="grid gap-4" onSubmit={handleCreate}>
          <label className="block text-sm">
            <span className="text-slate-600">{t("grades.field.programme")}</span>
            <select
              required
              className="renis-input mt-1"
              value={form.programmeId}
              onChange={(e) => setForm({ ...form, programmeId: e.target.value })}
            >
              <option value="">{t("grades.field.selectProgramme")}</option>
              {programmes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-600">
                {t("grades.field.academicYear")}
              </span>
              <input
                required
                className="renis-input mt-1"
                value={form.academicYear}
                onChange={(e) =>
                  setForm({ ...form, academicYear: e.target.value })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">
                {t("grades.field.semester")}
              </span>
              <select
                className="renis-input mt-1"
                value={form.semester}
                onChange={(e) => setForm({ ...form, semester: e.target.value })}
              >
                <option value="S1">S1</option>
                <option value="S2">S2</option>
              </select>
            </label>
          </div>
        </form>
      </Modal>

      {loading ? (
        <p className="text-slate-500 py-8">{t("common.loading")}</p>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          {t("grades.empty")}
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
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">
                  {t("grades.field.programme")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("grades.field.year")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("grades.field.semester")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("grades.field.status")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("grades.field.grades")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.id}
                  className="renis-table-row"
                  onClick={() => router.push(`/institution/grades/${s.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {s.programme.name}
                  </td>
                  <td className="px-4 py-3">{s.academicYear}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.semester} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s._count.grades}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PaginatedTable>
      )}
    </AppShell>
  );
}
