"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { canManageDiplomas } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import {
  InstitutionScopeBar,
  scopedInstitutionIdForCreate,
} from "@/components/InstitutionScopeBar";
import { withInstitutionQuery } from "@/lib/api-scope-query";
import { apiFetch } from "@/lib/api";
import { downloadWithAuth } from "@/lib/download";
import { buildDiplomaVerifyUrl } from "@/lib/verify-url";

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
  const [diplomas, setDiplomas] = useState<Diploma[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [scopeId, setScopeId] = useState("");
  const [form, setForm] = useState({
    studentId: "",
    type: "Licence",
    title: "",
    graduationYear: new Date().getFullYear(),
    honors: "",
  });
  const [studentSearch, setStudentSearch] = useState("");
  const [editTarget, setEditTarget] = useState<Diploma | null>(null);
  const [editForm, setEditForm] = useState({
    type: "",
    title: "",
    graduationYear: 0,
    honors: "",
    programmeName: "",
  });
  const [revokeTarget, setRevokeTarget] = useState<Diploma | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokePassword, setRevokePassword] = useState("");

  useEffect(() => {
    if (session && !canManageDiplomas(session.user?.role)) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  useEffect(() => {
    if (session?.accessToken) void load(session.accessToken, scopeId);
  }, [session?.accessToken, scopeId]);

  async function load(accessToken: string, institutionId?: string) {
    setLoading(true);
    setError(null);
    try {
      const [dRes, sRes] = await Promise.all([
        apiFetch(withInstitutionQuery("/api/diplomas", institutionId), {
          accessToken,
        }),
        apiFetch(withInstitutionQuery("/api/students", institutionId), {
          accessToken,
        }),
      ]);
      if (!dRes.ok) throw new Error("Could not load diplomas");
      setDiplomas(await dRes.json());
      if (sRes.ok) setStudents(await sRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

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
      setError(data.error ?? "Creation failed");
      return;
    }
    setShowForm(false);
    await load(session.accessToken, scopeId);
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
      setError(e instanceof Error ? e.message : "Preview failed");
    }
  }

  async function downloadPdf(diplomaId: string) {
    if (!session?.accessToken) return;
    const res = await apiFetch(`/api/diplomas/${diplomaId}/pdf`, {
      accessToken: session.accessToken,
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "PDF unavailable");
      return;
    }
    window.open(data.url as string, "_blank", "noopener,noreferrer");
  }

  async function patchDiploma(
    id: string,
    body: Record<string, string | undefined>
  ) {
    if (!session?.accessToken) return;
    const res = await apiFetch(`/api/diplomas/${id}`, {
      method: "PATCH",
      accessToken: session.accessToken,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Update failed");
      return;
    }
    await load(session.accessToken, scopeId);
  }

  return (
    <AppShell title="Diplomas">
      <InstitutionScopeBar onChange={setScopeId} />
      <p className="mb-6 text-sm text-slate-600 max-w-2xl">
        Workflow: DRAFT → SUBMITTED → PUBLISHED → optional REVOKED. Verification
        code is assigned on submit; PDF with QR is generated on publish (spec §5).
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowForm(!showForm)}
        className="mb-6 rounded-lg bg-renis-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        {showForm ? "Cancel" : "New diploma"}
      </button>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm grid gap-4 md:grid-cols-2"
        >
          <label className="block text-sm md:col-span-2">
            <span className="text-slate-600">Student</span>
            <input
              type="search"
              placeholder="Search by name or ID number…"
              className="mt-1 mb-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
            />
            <select
              required
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={form.studentId}
              onChange={(e) => setForm({ ...form, studentId: e.target.value })}
            >
              <option value="">— Select —</option>
              {students
                .filter((s) => {
                  const q = studentSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    s.firstName.toLowerCase().includes(q) ||
                    s.lastName.toLowerCase().includes(q) ||
                    s.studentIdNumber.toLowerCase().includes(q)
                  );
                })
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.lastName}, {s.firstName} ({s.studentIdNumber})
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Type</span>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Graduation year</span>
            <input
              required
              type="number"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={form.graduationYear}
              onChange={(e) =>
                setForm({ ...form, graduationYear: Number(e.target.value) })
              }
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-slate-600">Title</span>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-slate-600">Honors (optional)</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={form.honors}
              onChange={(e) => setForm({ ...form, honors: e.target.value })}
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-renis-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Create draft
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Verify code</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {diplomas.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    {d.student.lastName}, {d.student.firstName}
                  </td>
                  <td className="px-4 py-3">{d.title}</td>
                  <td className="px-4 py-3">{d.graduationYear}</td>
                  <td className="px-4 py-3">{d.status}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {d.uniqueCode ?? "—"}
                  </td>
                  <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                    {d.status === "DRAFT" && (
                      <>
                        <button
                          type="button"
                          className="text-slate-700 hover:underline text-xs"
                          onClick={() => void previewPdf(d.id)}
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          className="text-slate-700 hover:underline text-xs"
                          onClick={() => {
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
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-renis-primary hover:underline text-xs"
                          onClick={() =>
                            void patchDiploma(d.id, { action: "submit" })
                          }
                        >
                          Submit
                        </button>
                      </>
                    )}
                    {d.status === "SUBMITTED" && (
                      <>
                        <button
                          type="button"
                          className="text-slate-700 hover:underline text-xs"
                          onClick={() => void previewPdf(d.id)}
                        >
                          Preview PDF
                        </button>
                        <button
                          type="button"
                          className="text-green-700 hover:underline text-xs"
                          onClick={() =>
                            void patchDiploma(d.id, { action: "publish" })
                          }
                        >
                          Generate & publish
                        </button>
                      </>
                    )}
                    {d.status === "PUBLISHED" && (
                      <button
                        type="button"
                        className="text-red-700 hover:underline text-xs"
                        onClick={() => {
                          setRevokeTarget(d);
                          setRevokeReason("");
                          setRevokePassword("");
                        }}
                      >
                        Revoke
                      </button>
                    )}
                    {d.status === "PUBLISHED" && (
                      <>
                        <button
                          type="button"
                          className="text-slate-700 hover:underline text-xs"
                          onClick={() => void downloadPdf(d.id)}
                        >
                          PDF
                        </button>
                        <label className="text-slate-600 hover:underline text-xs cursor-pointer">
                          Check PDF
                          <input
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              if (!f || !session?.accessToken) return;
                              const fd = new FormData();
                              fd.append("file", f);
                              const res = await fetch(
                                `/api/diplomas/${d.id}/verify-integrity`,
                                {
                                  method: "POST",
                                  headers: {
                                    Authorization: `Bearer ${session.accessToken}`,
                                  },
                                  body: fd,
                                }
                              );
                              const data = await res.json();
                              if (!res.ok) {
                                setError(data.error ?? "Integrity check failed");
                                return;
                              }
                              setMessage(
                                data.match
                                  ? "PDF matches the archived original (SHA-256)."
                                  : "PDF does NOT match the archived hash."
                              );
                            }}
                          />
                        </label>
                        {d.uniqueCode && (
                          <a
                            href={buildDiplomaVerifyUrl(d.uniqueCode)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-600 hover:underline text-xs"
                          >
                            Verify
                          </a>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <form
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl grid gap-3 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              void patchDiploma(editTarget.id, {
                action: "update",
                type: editForm.type,
                title: editForm.title,
                graduationYear: editForm.graduationYear,
                honors: editForm.honors || null,
                programmeName: editForm.programmeName || null,
              }).then(() => setEditTarget(null));
            }}
          >
            <h3 className="font-medium text-slate-900">Edit draft diploma</h3>
            <label>
              Type
              <input
                required
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={editForm.type}
                onChange={(e) =>
                  setEditForm({ ...editForm, type: e.target.value })
                }
              />
            </label>
            <label>
              Programme
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={editForm.programmeName}
                onChange={(e) =>
                  setEditForm({ ...editForm, programmeName: e.target.value })
                }
              />
            </label>
            <label>
              Title
              <input
                required
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={editForm.title}
                onChange={(e) =>
                  setEditForm({ ...editForm, title: e.target.value })
                }
              />
            </label>
            <label>
              Graduation year
              <input
                required
                type="number"
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
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
              Honors
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={editForm.honors}
                onChange={(e) =>
                  setEditForm({ ...editForm, honors: e.target.value })
                }
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-4 py-2"
                onClick={() => setEditTarget(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-renis-primary px-4 py-2 text-white"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-medium text-slate-900 mb-2">Revoke diploma</h3>
            <p className="text-sm text-slate-600 mb-4">
              Irreversible. Reason (min. 100 characters) and your Keycloak password
              are required (spec §5.5).
            </p>
            <textarea
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm mb-3 min-h-[100px]"
              placeholder="Revocation reason…"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
            />
            <input
              type="password"
              autoComplete="current-password"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm mb-4"
              placeholder="Your password"
              value={revokePassword}
              onChange={(e) => setRevokePassword(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                onClick={() => setRevokeTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-700 px-4 py-2 text-sm text-white"
                onClick={() => {
                  const trimmed = revokeReason.trim();
                  if (trimmed.length < 100) {
                    setError(
                      `Revocation reason must be at least 100 characters (${trimmed.length}/100).`
                    );
                    return;
                  }
                  if (!revokePassword) {
                    setError("Password confirmation is required.");
                    return;
                  }
                  void patchDiploma(revokeTarget.id, {
                    action: "revoke",
                    revocationReason: trimmed,
                    password: revokePassword,
                  }).then(() => setRevokeTarget(null));
                }}
              >
                Revoke permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
