"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { canManageStudents } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import {
  InstitutionScopeBar,
  scopedInstitutionIdForCreate,
} from "@/components/InstitutionScopeBar";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { RowMenu } from "@/components/ui/RowMenu";
import { PaginatedTable } from "@/components/ui/PaginatedTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { withInstitutionQuery } from "@/lib/api-scope-query";
import { apiFetch } from "@/lib/api";
import { listApiUrl, normalizeListResponse } from "@/lib/list-response";
import { useT } from "@/lib/i18n/LocaleProvider";

type Student = {
  id: string;
  studentIdNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  nameConsent: boolean;
  active?: boolean;
};

type StudentFormState = {
  studentIdNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nameConsent: boolean;
};

const emptyForm: StudentFormState = {
  studentIdNumber: "",
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  nameConsent: false,
};

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function studentToForm(student: Student): StudentFormState {
  return {
    studentIdNumber: student.studentIdNumber,
    firstName: student.firstName,
    lastName: student.lastName,
    dateOfBirth: toDateInputValue(student.dateOfBirth),
    nameConsent: student.nameConsent,
  };
}

function StudentFormFields({
  form,
  setForm,
  idPrefix,
}: {
  form: StudentFormState;
  setForm: (next: StudentFormState) => void;
  idPrefix: string;
}) {
  const t = useT();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="block text-sm">
        <span className="text-slate-600">{t("students.field.id")}</span>
        <input
          required
          className="renis-input mt-1 font-mono"
          value={form.studentIdNumber}
          onChange={(e) =>
            setForm({ ...form, studentIdNumber: e.target.value })
          }
        />
      </label>
      <label className="block text-sm">
        <span className="text-slate-600">{t("students.field.dob")}</span>
        <input
          type="date"
          className="renis-input mt-1"
          value={form.dateOfBirth}
          onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="text-slate-600">
          {t("students.field.firstName")}
        </span>
        <input
          required
          className="renis-input mt-1"
          value={form.firstName}
          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="text-slate-600">{t("students.field.lastName")}</span>
        <input
          required
          className="renis-input mt-1"
          value={form.lastName}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
        />
      </label>
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input
          id={`${idPrefix}-name-consent`}
          type="checkbox"
          checked={form.nameConsent}
          onChange={(e) =>
            setForm({ ...form, nameConsent: e.target.checked })
          }
        />
        <span className="text-slate-600">{t("students.consentLabel")}</span>
      </label>
    </div>
  );
}

export default function StudentsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const t = useT();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Student | null>(null);
  const [detailTarget, setDetailTarget] = useState<Student | null>(null);
  const [scopeId, setScopeId] = useState("");
  const [form, setForm] = useState<StudentFormState>(emptyForm);
  const [editForm, setEditForm] = useState<StudentFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (session && !canManageStudents(session.user?.role)) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  const fetchPage = useCallback(
    async (page: number, pageSize: number) => {
      if (!session?.accessToken) throw new Error("Not signed in");
      const url = withInstitutionQuery(
        listApiUrl("/api/students", page, pageSize),
        scopeId
      );
      const res = await apiFetch(url, { accessToken: session.accessToken });
      if (!res.ok) throw new Error(t("students.couldNotLoad"));
      return normalizeListResponse<Student>(await res.json());
    },
    [session?.accessToken, scopeId]
  );

  const {
    items: students,
    loading,
    error,
    setError,
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
    totalPages,
    reload,
  } = usePaginatedList(fetchPage, [scopeId, session?.accessToken]);

  function openEdit(student: Student) {
    setDetailTarget(null);
    setEditTarget(student);
    setEditForm(studentToForm(student));
  }

  async function patchStudent(
    studentId: string,
    body: Record<string, unknown>
  ): Promise<Student | null> {
    if (!session?.accessToken) return null;
    const res = await apiFetch(`/api/students/${studentId}`, {
      method: "PATCH",
      accessToken: session.accessToken,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? t("users.updateFailed"));
      return null;
    }
    return data as Student;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;
    setError(null);
    setMessage(null);
    const institutionId = scopedInstitutionIdForCreate();
    const res = await apiFetch("/api/students", {
      method: "POST",
      accessToken: session.accessToken,
      body: JSON.stringify({
        ...form,
        dateOfBirth: form.dateOfBirth || null,
        ...(institutionId ? { institutionId } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? t("users.createFailed"));
      return;
    }
    setCreateOpen(false);
    setForm(emptyForm);
    setMessage(t("students.created"));
    await reload();
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken || !editTarget) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const updated = await patchStudent(editTarget.id, {
      studentIdNumber: editForm.studentIdNumber.trim(),
      firstName: editForm.firstName.trim(),
      lastName: editForm.lastName.trim(),
      dateOfBirth: editForm.dateOfBirth || null,
      nameConsent: editForm.nameConsent,
    });
    setSaving(false);
    if (!updated) return;
    setEditTarget(null);
    setMessage(
      t("students.updated", {
        name: `${updated.firstName} ${updated.lastName}`,
      })
    );
    await reload();
  }

  async function toggleConsent(student: Student) {
    if (!session?.accessToken) return;
    setError(null);
    const updated = await patchStudent(student.id, {
      nameConsent: !student.nameConsent,
    });
    if (!updated) return;
    if (detailTarget?.id === student.id) setDetailTarget(updated);
    if (editTarget?.id === student.id) {
      setEditTarget(updated);
      setEditForm((f) => ({ ...f, nameConsent: updated.nameConsent }));
    }
    setMessage(
      updated.nameConsent
        ? t("students.consentGranted")
        : t("students.consentRevoked")
    );
    await reload();
  }

  function rowMenuItems(s: Student) {
    return [
      { label: t("common.viewDetails"), onClick: () => setDetailTarget(s) },
      { label: t("students.editStudent"), onClick: () => openEdit(s) },
      {
        label: s.nameConsent
          ? t("students.revokeConsent")
          : t("students.grantConsent"),
        onClick: () => void toggleConsent(s),
      },
    ];
  }

  return (
    <AppShell title={t("students.title")}>
      <InstitutionScopeBar onChange={setScopeId} />

      <PageHeader
        description={t("students.description")}
        actions={
          <button
            type="button"
            className="renis-btn-primary"
            onClick={() => {
              setForm(emptyForm);
              setCreateOpen(true);
            }}
          >
            {t("students.add")}
          </button>
        }
      />

      {error ? <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert> : null}
      {message ? (
        <Alert variant="success" onDismiss={() => setMessage(null)}>
          {message}
        </Alert>
      ) : null}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("students.addTitle")}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="renis-btn-secondary"
              onClick={() => setCreateOpen(false)}
            >
              {t("common.cancel")}
            </button>
            <button type="submit" form="student-create-form" className="renis-btn-primary">
              {t("students.saveStudent")}
            </button>
          </div>
        }
      >
        <form id="student-create-form" onSubmit={handleCreate}>
          <StudentFormFields
            form={form}
            setForm={setForm}
            idPrefix="create"
          />
        </form>
      </Modal>

      <Modal
        open={!!editTarget}
        onClose={() => !saving && setEditTarget(null)}
        title={t("students.editTitle")}
        description={editTarget ? editTarget.studentIdNumber : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="renis-btn-secondary"
              disabled={saving}
              onClick={() => setEditTarget(null)}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              form="student-edit-form"
              disabled={saving}
              className="renis-btn-primary disabled:opacity-50"
            >
              {saving ? t("common.saving") : t("common.saveChanges")}
            </button>
          </div>
        }
      >
        <form id="student-edit-form" onSubmit={handleEdit}>
          <StudentFormFields
            form={editForm}
            setForm={setEditForm}
            idPrefix="edit"
          />
        </form>
      </Modal>

      <Modal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title={
          detailTarget
            ? `${detailTarget.firstName} ${detailTarget.lastName}`
            : t("students.detailTitle")
        }
        description={detailTarget?.studentIdNumber}
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
                className="renis-btn-secondary"
                onClick={() => openEdit(detailTarget)}
              >
                {t("common.edit")}
              </button>
              <button
                type="button"
                className="renis-btn-primary"
                onClick={() => void toggleConsent(detailTarget)}
              >
                {detailTarget.nameConsent
                  ? t("students.revokeConsent")
                  : t("students.grantConsent")}
              </button>
            </div>
          ) : null
        }
      >
        {detailTarget ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{t("students.field.id")}</dt>
              <dd className="font-mono text-slate-900">{detailTarget.studentIdNumber}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("students.field.dob")}</dt>
              <dd className="text-slate-900">
                {detailTarget.dateOfBirth
                  ? new Date(detailTarget.dateOfBirth).toLocaleDateString()
                  : t("common.dash")}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">
                {t("students.field.nameConsent")}
              </dt>
              <dd>
                <StatusBadge
                  status={detailTarget.nameConsent ? "ACTIVE" : "INACTIVE"}
                  label={
                    detailTarget.nameConsent
                      ? t("status.Granted")
                      : t("status.NotGranted")
                  }
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
          {t("students.empty")}
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
                  {t("students.field.id")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("students.field.name")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("students.field.dobShort")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("students.field.consent")}
                </th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr
                  key={s.id}
                  className="renis-table-row"
                  onClick={() => setDetailTarget(s)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">
                    {s.studentIdNumber}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {s.firstName} {s.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {s.dateOfBirth
                      ? new Date(s.dateOfBirth).toLocaleDateString()
                      : t("common.dash")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={s.nameConsent ? "ACTIVE" : "INACTIVE"}
                      label={s.nameConsent ? t("common.yes") : t("common.no")}
                    />
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <RowMenu
                      label={t("common.actionsFor", { target: s.firstName })}
                      items={rowMenuItems(s)}
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
