"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { canManageGrades } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import {
  InstitutionScopeBar,
  scopedInstitutionIdForCreate,
} from "@/components/InstitutionScopeBar";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaginatedTable } from "@/components/ui/PaginatedTable";
import { RowMenu } from "@/components/ui/RowMenu";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { withInstitutionQuery } from "@/lib/api-scope-query";
import { apiFetch } from "@/lib/api";
import { listApiUrl, normalizeListResponse } from "@/lib/list-response";

type Subject = {
  id: string;
  code: string;
  name: string;
  semester: string;
  yearLevel: number;
  credits: number;
  coefficient: number;
};

type Programme = {
  id: string;
  code: string;
  name: string;
  subjects: Subject[];
};

export default function ProgrammesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [scopeId, setScopeId] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Programme | null>(null);
  const [subjectTarget, setSubjectTarget] = useState<Programme | null>(null);
  const [enrollTarget, setEnrollTarget] = useState<Programme | null>(null);

  const [programmeForm, setProgrammeForm] = useState({ code: "", name: "" });
  const [subjectForm, setSubjectForm] = useState({
    code: "",
    name: "",
    semester: "S1",
    yearLevel: 1,
    credits: 3,
    coefficient: 1,
  });
  const [allStudents, setAllStudents] = useState<
    { id: string; studentIdNumber: string; firstName: string; lastName: string }[]
  >([]);
  const [enrolledIds, setEnrolledIds] = useState<string[]>([]);
  const [selectedEnroll, setSelectedEnroll] = useState<string[]>([]);

  useEffect(() => {
    if (session && !canManageGrades(session.user?.role)) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  const fetchPage = useCallback(
    async (page: number, pageSize: number) => {
      if (!session?.accessToken) throw new Error("Not signed in");
      const url = withInstitutionQuery(
        listApiUrl("/api/programmes", page, pageSize),
        scopeId
      );
      const res = await apiFetch(url, { accessToken: session.accessToken });
      if (!res.ok) throw new Error("Could not load programmes");
      return normalizeListResponse<Programme>(await res.json());
    },
    [session?.accessToken, scopeId]
  );

  const {
    items: programmes,
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

  async function createProgramme(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;
    const institutionId = scopedInstitutionIdForCreate();
    const res = await apiFetch("/api/programmes", {
      method: "POST",
      accessToken: session.accessToken,
      body: JSON.stringify({
        ...programmeForm,
        ...(institutionId ? { institutionId } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Creation failed");
      return;
    }
    setCreateOpen(false);
    setProgrammeForm({ code: "", name: "" });
    await reload();
  }

  async function addSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken || !subjectTarget) return;
    const res = await apiFetch(`/api/programmes/${subjectTarget.id}/subjects`, {
      method: "POST",
      accessToken: session.accessToken,
      body: JSON.stringify(subjectForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not add subject");
      return;
    }
    setSubjectTarget(null);
    setSubjectForm({
      code: "",
      name: "",
      semester: "S1",
      yearLevel: 1,
      credits: 3,
      coefficient: 1,
    });
    await reload();
  }

  async function openEnrollment(programme: Programme) {
    if (!session?.accessToken) return;
    setEnrollTarget(programme);
    setError(null);
    const [sRes, eRes] = await Promise.all([
      apiFetch(withInstitutionQuery("/api/students?all=true", scopeId), {
        accessToken: session.accessToken,
      }),
      apiFetch(`/api/programmes/${programme.id}/enrollments`, {
        accessToken: session.accessToken,
      }),
    ]);
    if (sRes.ok) {
      const data = normalizeListResponse<{
        id: string;
        studentIdNumber: string;
        firstName: string;
        lastName: string;
      }>(await sRes.json());
      setAllStudents(data.items);
    }
    if (eRes.ok) {
      const enrolled: { student: { id: string } }[] = await eRes.json();
      const ids = enrolled.map((e) => e.student.id);
      setEnrolledIds(ids);
      setSelectedEnroll(ids);
    }
  }

  async function saveEnrollment(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken || !enrollTarget) return;
    const res = await apiFetch(`/api/programmes/${enrollTarget.id}/enrollments`, {
      method: "POST",
      accessToken: session.accessToken,
      body: JSON.stringify({ studentIds: selectedEnroll }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Enrollment failed");
      return;
    }
    setEnrollTarget(null);
  }

  function menuItems(p: Programme) {
    return [
      { label: "View details", onClick: () => setDetailTarget(p) },
      { label: "Enroll students", onClick: () => void openEnrollment(p) },
      { label: "Add subject", onClick: () => setSubjectTarget(p) },
    ];
  }

  return (
    <AppShell title="Programmes & subjects">
      <InstitutionScopeBar onChange={setScopeId} />

      <PageHeader
        description="Define programmes, subjects, and student enrollments. Grade grids only show students enrolled in the programme."
        actions={
          <button
            type="button"
            className="renis-btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            New programme
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
        title="New programme"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="renis-btn-secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="programme-create-form" className="renis-btn-primary">
              Create programme
            </button>
          </div>
        }
      >
        <form id="programme-create-form" className="grid gap-4 sm:grid-cols-2" onSubmit={createProgramme}>
          <label className="text-sm">
            <span className="text-slate-600">Code</span>
            <input
              required
              className="renis-input mt-1"
              value={programmeForm.code}
              onChange={(e) =>
                setProgrammeForm({ ...programmeForm, code: e.target.value })
              }
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Name</span>
            <input
              required
              className="renis-input mt-1"
              value={programmeForm.name}
              onChange={(e) =>
                setProgrammeForm({ ...programmeForm, name: e.target.value })
              }
            />
          </label>
        </form>
      </Modal>

      <Modal
        open={!!subjectTarget}
        onClose={() => setSubjectTarget(null)}
        title={subjectTarget ? `Add subject — ${subjectTarget.code}` : "Add subject"}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="renis-btn-secondary" onClick={() => setSubjectTarget(null)}>
              Cancel
            </button>
            <button type="submit" form="subject-form" className="renis-btn-primary">
              Save subject
            </button>
          </div>
        }
      >
        <form id="subject-form" className="grid gap-4 sm:grid-cols-2" onSubmit={addSubject}>
          <label className="text-sm">
            <span className="text-slate-600">Subject code</span>
            <input
              required
              className="renis-input mt-1"
              value={subjectForm.code}
              onChange={(e) =>
                setSubjectForm({ ...subjectForm, code: e.target.value })
              }
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Name</span>
            <input
              required
              className="renis-input mt-1"
              value={subjectForm.name}
              onChange={(e) =>
                setSubjectForm({ ...subjectForm, name: e.target.value })
              }
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Semester</span>
            <select
              className="renis-input mt-1"
              value={subjectForm.semester}
              onChange={(e) =>
                setSubjectForm({ ...subjectForm, semester: e.target.value })
              }
            >
              <option value="S1">S1</option>
              <option value="S2">S2</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Year level</span>
            <input
              type="number"
              min={1}
              max={6}
              className="renis-input mt-1"
              value={subjectForm.yearLevel}
              onChange={(e) =>
                setSubjectForm({
                  ...subjectForm,
                  yearLevel: Number(e.target.value),
                })
              }
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Credits</span>
            <input
              type="number"
              min={0}
              className="renis-input mt-1"
              value={subjectForm.credits}
              onChange={(e) =>
                setSubjectForm({
                  ...subjectForm,
                  credits: Number(e.target.value),
                })
              }
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Coefficient</span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              className="renis-input mt-1"
              value={subjectForm.coefficient}
              onChange={(e) =>
                setSubjectForm({
                  ...subjectForm,
                  coefficient: Number(e.target.value),
                })
              }
            />
          </label>
        </form>
      </Modal>

      <Modal
        open={!!enrollTarget}
        onClose={() => setEnrollTarget(null)}
        title={enrollTarget ? `Enroll students — ${enrollTarget.name}` : "Enrollment"}
        description={`Currently enrolled: ${enrolledIds.length}`}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="renis-btn-secondary" onClick={() => setEnrollTarget(null)}>
              Cancel
            </button>
            <button type="submit" form="enroll-form" className="renis-btn-primary">
              Save enrollment
            </button>
          </div>
        }
      >
        <form id="enroll-form" onSubmit={saveEnrollment}>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 p-3 space-y-2 text-sm">
            {allStudents.length === 0 ? (
              <p className="text-slate-500">No students in this institution.</p>
            ) : (
              allStudents.map((s) => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedEnroll.includes(s.id)}
                    onChange={(e) => {
                      setSelectedEnroll((prev) =>
                        e.target.checked
                          ? [...prev, s.id]
                          : prev.filter((id) => id !== s.id)
                      );
                    }}
                  />
                  {s.lastName}, {s.firstName} ({s.studentIdNumber})
                </label>
              ))
            )}
          </div>
        </form>
      </Modal>

      <Modal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title={detailTarget ? `${detailTarget.code} — ${detailTarget.name}` : "Programme"}
        size="lg"
        footer={
          detailTarget ? (
            <div className="flex justify-end gap-2">
              <button type="button" className="renis-btn-secondary" onClick={() => setDetailTarget(null)}>
                Close
              </button>
              <button
                type="button"
                className="renis-btn-primary"
                onClick={() => {
                  void openEnrollment(detailTarget);
                  setDetailTarget(null);
                }}
              >
                Enroll students
              </button>
            </div>
          ) : null
        }
      >
        {detailTarget ? (
          detailTarget.subjects.length === 0 ? (
            <p className="text-sm text-slate-500">No subjects defined yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Sem.</th>
                  <th className="py-2 pr-3">Year</th>
                  <th className="py-2">Coef.</th>
                </tr>
              </thead>
              <tbody>
                {detailTarget.subjects.map((s) => (
                  <tr key={s.id} className="border-t border-slate-50">
                    <td className="py-2 pr-3 font-mono text-xs">{s.code}</td>
                    <td className="py-2 pr-3">{s.name}</td>
                    <td className="py-2 pr-3">{s.semester}</td>
                    <td className="py-2 pr-3">{s.yearLevel}</td>
                    <td className="py-2">{s.coefficient}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}
      </Modal>

      {loading ? (
        <p className="text-slate-500 py-8">Loading…</p>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          No programmes yet.
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
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Subjects</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {programmes.map((p) => (
                <tr
                  key={p.id}
                  className="renis-table-row"
                  onClick={() => setDetailTarget(p)}
                >
                  <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.subjects.length}</td>
                  <td className="px-4 py-3">
                    <RowMenu label={`Actions for ${p.code}`} items={menuItems(p)} />
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
