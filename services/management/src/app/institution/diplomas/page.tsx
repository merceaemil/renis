"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { canManageDiplomas } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import {
  InstitutionScopeBar,
  scopedInstitutionIdForCreate,
} from "@/components/InstitutionScopeBar";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { RowMenu, type RowMenuItem } from "@/components/ui/RowMenu";
import { PaginatedTable } from "@/components/ui/PaginatedTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { withInstitutionQuery } from "@/lib/api-scope-query";
import { apiFetch } from "@/lib/api";
import { listApiUrl, normalizeListResponse } from "@/lib/list-response";
import { downloadWithAuth } from "@/lib/download";
import { buildDiplomaVerifyUrl } from "@/lib/verify-url";
import { useT } from "@/lib/i18n/LocaleProvider";

type Student = {
  id: string;
  studentIdNumber: string;
  firstName: string;
  lastName: string;
};

type Diploma = {
  id: string;
  uniqueCode: string | null;
  type: string;
  title: string;
  graduationYear: number;
  honors: string | null;
  status: string;
  student: Student;
};

export default function DiplomasPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const t = useT();
  const integrityInputRef = useRef<HTMLInputElement>(null);
  const [integrityDiplomaId, setIntegrityDiplomaId] = useState<string | null>(
    null
  );

  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [scopeId, setScopeId] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Diploma | null>(null);
  const [editTarget, setEditTarget] = useState<Diploma | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Diploma | null>(null);

  const [form, setForm] = useState({
    studentId: "",
    type: "Licence",
    title: "",
    graduationYear: new Date().getFullYear(),
    honors: "",
  });
  const [studentSearch, setStudentSearch] = useState("");
  const [editForm, setEditForm] = useState({
    type: "",
    title: "",
    graduationYear: 0,
    honors: "",
    programmeName: "",
  });
  const [revokeReason, setRevokeReason] = useState("");
  const [revokePassword, setRevokePassword] = useState("");

  useEffect(() => {
    if (session && !canManageDiplomas(session.user?.role)) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  const fetchPage = useCallback(
    async (page: number, pageSize: number) => {
      if (!session?.accessToken) throw new Error("Not signed in");
      const url = withInstitutionQuery(
        listApiUrl("/api/diplomas", page, pageSize),
        scopeId
      );
      const res = await apiFetch(url, { accessToken: session.accessToken });
      if (!res.ok) throw new Error(t("diplomas.couldNotLoad"));
      return normalizeListResponse<Diploma>(await res.json());
    },
    [session?.accessToken, scopeId]
  );

  const {
    items: diplomas,
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
  } = usePaginatedList(fetchPage, [scopeId, session?.accessToken]);

  useEffect(() => {
    if (!session?.accessToken) return;
    void (async () => {
      const url = withInstitutionQuery("/api/students?all=true", scopeId);
      const res = await apiFetch(url, { accessToken: session.accessToken });
      if (res.ok) {
        const data = normalizeListResponse<Student>(await res.json());
        setStudents(data.items);
      }
    })();
  }, [session?.accessToken, scopeId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;
    setError(null);
    const institutionId = scopedInstitutionIdForCreate();
    const res = await apiFetch("/api/diplomas", {
      method: "POST",
      accessToken: session.accessToken,
      body: JSON.stringify({
        ...form,
        honors: form.honors || null,
        ...(institutionId ? { institutionId } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? t("diplomas.creationFailed"));
      return;
    }
    setCreateOpen(false);
    setForm({
      studentId: "",
      type: "Licence",
      title: "",
      graduationYear: new Date().getFullYear(),
      honors: "",
    });
    await reload();
  }

  async function previewPdf(diplomaId: string) {
    if (!session?.accessToken) return;
    try {
      await downloadWithAuth(
        `/api/diplomas/${diplomaId}/preview`,
        session.accessToken,
        `diploma-preview.pdf`,
        true
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("diplomas.previewFailed"));
    }
  }

  async function downloadPdf(diplomaId: string) {
    if (!session?.accessToken) return;
    const res = await apiFetch(`/api/diplomas/${diplomaId}/pdf`, {
      accessToken: session.accessToken,
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? t("diplomas.pdfUnavailable"));
      return;
    }
    window.open(data.url as string, "_blank", "noopener,noreferrer");
  }

  async function patchDiploma(
    id: string,
    body: Record<string, string | number | null | undefined>
  ) {
    if (!session?.accessToken) return false;
    const res = await apiFetch(`/api/diplomas/${id}`, {
      method: "PATCH",
      accessToken: session.accessToken,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? t("diplomas.updateFailed"));
      return false;
    }
    await reload();
    return true;
  }

  function menuItems(d: Diploma): RowMenuItem[] {
    const items: RowMenuItem[] = [];
    if (d.status === "DRAFT") {
      items.push(
        {
          label: t("diplomas.menu.previewPdf"),
          onClick: () => void previewPdf(d.id),
        },
        {
          label: t("diplomas.menu.editDraft"),
          onClick: () => {
            setEditTarget(d);
            setEditForm({
              type: d.type,
              title: d.title,
              graduationYear: d.graduationYear,
              honors: d.honors ?? "",
              programmeName: "",
            });
          },
        },
        {
          label: t("diplomas.menu.submitReview"),
          onClick: () => void patchDiploma(d.id, { action: "submit" }),
        }
      );
    }
    if (d.status === "SUBMITTED") {
      items.push(
        {
          label: t("diplomas.menu.previewPdf"),
          onClick: () => void previewPdf(d.id),
        },
        {
          label: t("diplomas.menu.publish"),
          onClick: () => void patchDiploma(d.id, { action: "publish" }),
        }
      );
    }
    if (d.status === "PUBLISHED") {
      items.push(
        {
          label: t("diplomas.menu.downloadPdf"),
          onClick: () => void downloadPdf(d.id),
        },
        {
          label: t("diplomas.menu.checkIntegrity"),
          onClick: () => {
            setIntegrityDiplomaId(d.id);
            integrityInputRef.current?.click();
          },
        },
        {
          label: t("diplomas.menu.openVerify"),
          onClick: () => {
            if (d.uniqueCode) {
              window.open(
                buildDiplomaVerifyUrl(d.uniqueCode),
                "_blank",
                "noopener,noreferrer"
              );
            }
          },
          disabled: !d.uniqueCode,
        },
        {
          label: t("diplomas.menu.revoke"),
          variant: "danger",
          onClick: () => {
            setRevokeTarget(d);
            setRevokeReason("");
            setRevokePassword("");
          },
        }
      );
    }
    return items;
  }

  const filteredStudents = students.filter((s) => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.studentIdNumber.toLowerCase().includes(q)
    );
  });

  return (
    <AppShell title={t("diplomas.title")}>
      <InstitutionScopeBar onChange={setScopeId} />

      <PageHeader
        description={t("diplomas.description")}
        actions={
          <button
            type="button"
            className="renis-btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            {t("diplomas.new")}
          </button>
        }
      />

      {(error ?? listError) ? (
        <Alert variant="error" onDismiss={() => { setError(null); setListError(null); }}>
          {error ?? listError}
        </Alert>
      ) : null}
      {message ? (
        <Alert variant="success" onDismiss={() => setMessage(null)}>
          {message}
        </Alert>
      ) : null}

      <input
        ref={integrityInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          const id = integrityDiplomaId;
          setIntegrityDiplomaId(null);
          if (!f || !id || !session?.accessToken) return;
          const fd = new FormData();
          fd.append("file", f);
          const res = await fetch(`/api/diplomas/${id}/verify-integrity`, {
            method: "POST",
            headers: { Authorization: `Bearer ${session.accessToken}` },
            body: fd,
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.error ?? t("diplomas.integrityFailed"));
            return;
          }
          setMessage(
            data.match
              ? t("diplomas.integrityMatch")
              : t("diplomas.integrityMismatch")
          );
        }}
      />

      {loading ? (
        <p className="text-slate-500 py-8">{t("common.loading")}</p>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          {t("diplomas.empty.prefix")}{" "}
          <strong>{t("diplomas.empty.action")}</strong>{" "}
          {t("diplomas.empty.suffix")}
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
                  {t("diplomas.field.student")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("diplomas.field.title")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("diplomas.field.year")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("diplomas.field.status")}
                </th>
                <th
                  className="px-4 py-3 font-medium w-10"
                  aria-label={t("common.actions")}
                />
              </tr>
            </thead>
            <tbody>
              {diplomas.map((d) => (
                <tr
                  key={d.id}
                  className="renis-table-row"
                  onClick={() => setDetailTarget(d)}
                >
                  <td className="px-4 py-3">
                    {d.student.lastName}, {d.student.firstName}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {d.title}
                  </td>
                  <td className="px-4 py-3">{d.graduationYear}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <RowMenu items={menuItems(d)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PaginatedTable>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("diplomas.newTitle")}
        description={t("diplomas.newDescription")}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="renis-btn-secondary"
              onClick={() => setCreateOpen(false)}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              form="diploma-create-form"
              className="renis-btn-primary"
            >
              {t("diplomas.createDraft")}
            </button>
          </div>
        }
      >
        <form id="diploma-create-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleCreate}>
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-600">{t("diplomas.field.student")}</span>
            <input
              type="search"
              placeholder={t("diplomas.field.studentSearch")}
              className="renis-input mt-1 mb-2"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
            />
            <select
              required
              className="renis-input"
              value={form.studentId}
              onChange={(e) => setForm({ ...form, studentId: e.target.value })}
            >
              <option value="">{t("diplomas.field.selectStudent")}</option>
              {filteredStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.lastName}, {s.firstName} ({s.studentIdNumber})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">{t("diplomas.field.type")}</span>
            <input
              required
              className="renis-input mt-1"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">
              {t("diplomas.field.graduationYear")}
            </span>
            <input
              required
              type="number"
              className="renis-input mt-1"
              value={form.graduationYear}
              onChange={(e) =>
                setForm({ ...form, graduationYear: Number(e.target.value) })
              }
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-600">{t("diplomas.field.title")}</span>
            <input
              required
              className="renis-input mt-1"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-600">
              {t("diplomas.field.honorsOptional")}
            </span>
            <input
              className="renis-input mt-1"
              value={form.honors}
              onChange={(e) => setForm({ ...form, honors: e.target.value })}
            />
          </label>
        </form>
      </Modal>

      <Modal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title={detailTarget?.title ?? t("diplomas.detailFallback")}
        description={
          detailTarget
            ? `${detailTarget.student.lastName}, ${detailTarget.student.firstName}`
            : undefined
        }
        footer={
          detailTarget ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="renis-btn-secondary"
                onClick={() => setDetailTarget(null)}
              >
                {t("common.close")}
              </button>
              {detailTarget.status === "DRAFT" && (
                <button
                  type="button"
                  className="renis-btn-primary"
                  onClick={() => {
                    const d = detailTarget;
                    setDetailTarget(null);
                    setEditTarget(d);
                    setEditForm({
                      type: d.type,
                      title: d.title,
                      graduationYear: d.graduationYear,
                      honors: d.honors ?? "",
                      programmeName: "",
                    });
                  }}
                >
                  {t("diplomas.menu.editDraft")}
                </button>
              )}
            </div>
          ) : undefined
        }
      >
        {detailTarget ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{t("diplomas.field.status")}</dt>
              <dd className="mt-0.5">
                <StatusBadge status={detailTarget.status} />
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("diplomas.field.type")}</dt>
              <dd className="mt-0.5 font-medium">{detailTarget.type}</dd>
            </div>
            <div>
              <dt className="text-slate-500">
                {t("diplomas.field.graduationYear")}
              </dt>
              <dd className="mt-0.5 font-medium">{detailTarget.graduationYear}</dd>
            </div>
            <div>
              <dt className="text-slate-500">
                {t("diplomas.verificationCode")}
              </dt>
              <dd className="mt-0.5 font-mono text-xs break-all">
                {detailTarget.uniqueCode ?? t("diplomas.codeOnSubmit")}
              </dd>
            </div>
            {detailTarget.honors ? (
              <div className="sm:col-span-2">
                <dt className="text-slate-500">
                  {t("diplomas.field.honors")}
                </dt>
                <dd className="mt-0.5">{detailTarget.honors}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </Modal>

      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={t("diplomas.editDraftTitle")}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="renis-btn-secondary" onClick={() => setEditTarget(null)}>
              {t("common.cancel")}
            </button>
            <button type="submit" form="diploma-edit-form" className="renis-btn-primary">
              {t("common.saveChanges")}
            </button>
          </div>
        }
      >
        {editTarget ? (
          <form
            id="diploma-edit-form"
            className="grid gap-3 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              void patchDiploma(editTarget.id, {
                action: "update",
                type: editForm.type,
                title: editForm.title,
                graduationYear: editForm.graduationYear,
                honors: editForm.honors || null,
                programmeName: editForm.programmeName || null,
              }).then((ok) => ok && setEditTarget(null));
            }}
          >
            <label>
              <span className="text-slate-600">{t("diplomas.field.type")}</span>
              <input
                required
                className="renis-input mt-1"
                value={editForm.type}
                onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
              />
            </label>
            <label>
              <span className="text-slate-600">
                {t("diplomas.field.programme")}
              </span>
              <input
                className="renis-input mt-1"
                value={editForm.programmeName}
                onChange={(e) =>
                  setEditForm({ ...editForm, programmeName: e.target.value })
                }
              />
            </label>
            <label>
              <span className="text-slate-600">{t("diplomas.field.title")}</span>
              <input
                required
                className="renis-input mt-1"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </label>
            <label>
              <span className="text-slate-600">
                {t("diplomas.field.graduationYear")}
              </span>
              <input
                required
                type="number"
                className="renis-input mt-1"
                value={editForm.graduationYear}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    graduationYear: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              <span className="text-slate-600">
                {t("diplomas.field.honors")}
              </span>
              <input
                className="renis-input mt-1"
                value={editForm.honors}
                onChange={(e) => setEditForm({ ...editForm, honors: e.target.value })}
              />
            </label>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title={t("diplomas.revokeTitle")}
        description={t("diplomas.revokeDescription")}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="renis-btn-secondary" onClick={() => setRevokeTarget(null)}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="renis-btn-danger"
              onClick={() => {
                const trimmed = revokeReason.trim();
                if (trimmed.length < 100) {
                  setError(
                    t("diplomas.revokeReasonTooShort", {
                      count: trimmed.length,
                    })
                  );
                  return;
                }
                if (!revokePassword) {
                  setError(t("diplomas.passwordRequired"));
                  return;
                }
                if (!revokeTarget) return;
                void patchDiploma(revokeTarget.id, {
                  action: "revoke",
                  revocationReason: trimmed,
                  password: revokePassword,
                }).then((ok) => ok && setRevokeTarget(null));
              }}
            >
              {t("diplomas.revokeAction")}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <textarea
            className="renis-input min-h-[100px]"
            placeholder={t("diplomas.revokeReasonPlaceholder")}
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
          />
          <input
            type="password"
            autoComplete="current-password"
            className="renis-input"
            placeholder={t("diplomas.revokePasswordPlaceholder")}
            value={revokePassword}
            onChange={(e) => setRevokePassword(e.target.value)}
          />
        </div>
      </Modal>
    </AppShell>
  );
}
