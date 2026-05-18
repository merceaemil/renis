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
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="block text-sm">
        <span className="text-slate-600">Student ID</span>
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
        <span className="text-slate-600">Date of birth</span>
        <input
          type="date"
          className="renis-input mt-1"
          value={form.dateOfBirth}
          onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="text-slate-600">First name</span>
        <input
          required
          className="renis-input mt-1"
          value={form.firstName}
          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="text-slate-600">Last name</span>
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
        <span className="text-slate-600">
          Consent to display full name on public diploma verification
        </span>
      </label>
    </div>
  );
}

export default function StudentsPage() {
  const { data: session } = useSession();
  const router = useRouter();
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
      if (!res.ok) throw new Error("Could not load students");
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
      setError(data.error ?? "Update failed");
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
      setError(data.error ?? "Creation failed");
      return;
    }
    setCreateOpen(false);
    setForm(emptyForm);
    setMessage("Student created.");
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
    setMessage(`Updated ${updated.firstName} ${updated.lastName}.`);
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
      updated.nameConsent ? "Name consent granted." : "Name consent revoked."
    );
    await reload();
  }

  function rowMenuItems(s: Student) {
    return [
      { label: "View details", onClick: () => setDetailTarget(s) },
      { label: "Edit student", onClick: () => openEdit(s) },
      {
        label: s.nameConsent ? "Revoke name consent" : "Grant name consent",
        onClick: () => void toggleConsent(s),
      },
    ];
  }

  return (
    <AppShell title="Students">
      <InstitutionScopeBar onChange={setScopeId} />

      <PageHeader
        description="Register and maintain students for your institution. Name consent controls whether the full name appears on public diploma verification."
        actions={
          <button
            type="button"
            className="renis-btn-primary"
            onClick={() => {
              setForm(emptyForm);
              setCreateOpen(true);
            }}
          >
            Add student
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
        title="Add student"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="renis-btn-secondary"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" form="student-create-form" className="renis-btn-primary">
              Save student
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
        title="Edit student"
        description={editTarget ? editTarget.studentIdNumber : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="renis-btn-secondary"
              disabled={saving}
              onClick={() => setEditTarget(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="student-edit-form"
              disabled={saving}
              className="renis-btn-primary disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
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
            : "Student"
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
                Close
              </button>
              <button
                type="button"
                className="renis-btn-secondary"
                onClick={() => openEdit(detailTarget)}
              >
                Edit
              </button>
              <button
                type="button"
                className="renis-btn-primary"
                onClick={() => void toggleConsent(detailTarget)}
              >
                {detailTarget.nameConsent
                  ? "Revoke name consent"
                  : "Grant name consent"}
              </button>
            </div>
          ) : null
        }
      >
        {detailTarget ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Student ID</dt>
              <dd className="font-mono text-slate-900">{detailTarget.studentIdNumber}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Date of birth</dt>
              <dd className="text-slate-900">
                {detailTarget.dateOfBirth
                  ? new Date(detailTarget.dateOfBirth).toLocaleDateString()
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Name consent</dt>
              <dd>
                <StatusBadge
                  status={detailTarget.nameConsent ? "ACTIVE" : "INACTIVE"}
                  label={detailTarget.nameConsent ? "Granted" : "Not granted"}
                />
              </dd>
            </div>
          </dl>
        ) : null}
      </Modal>

      {loading ? (
        <p className="text-slate-500 py-8">Loading…</p>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          No students yet. Add one to get started.
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
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">DOB</th>
                <th className="px-4 py-3 font-medium">Consent</th>
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
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={s.nameConsent ? "ACTIVE" : "INACTIVE"}
                      label={s.nameConsent ? "Yes" : "No"}
                    />
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <RowMenu
                      label={`Actions for ${s.firstName}`}
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
