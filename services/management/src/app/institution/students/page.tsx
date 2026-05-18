"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { canManageStudents } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import {
  InstitutionScopeBar,
  scopedInstitutionIdForCreate,
} from "@/components/InstitutionScopeBar";
import { withInstitutionQuery } from "@/lib/api-scope-query";
import { apiFetch } from "@/lib/api";

type Student = {
  id: string;
  studentIdNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  nameConsent: boolean;
};

export default function StudentsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [scopeId, setScopeId] = useState("");
  const [form, setForm] = useState({
    studentIdNumber: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    nameConsent: false,
  });

  useEffect(() => {
    if (session && !canManageStudents(session.user?.role)) {
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
      const res = await apiFetch(withInstitutionQuery("/api/students", institutionId), {
        accessToken,
      });
      if (!res.ok) throw new Error("Could not load students");
      setStudents(await res.json());
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
    setShowForm(false);
    setForm({
      studentIdNumber: "",
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      nameConsent: false,
    });
    await load(session.accessToken, scopeId);
  }

  async function toggleConsent(student: Student) {
    if (!session?.accessToken) return;
    const res = await apiFetch(`/api/students/${student.id}`, {
      method: "PATCH",
      accessToken: session.accessToken,
      body: JSON.stringify({ nameConsent: !student.nameConsent }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Update failed");
      return;
    }
    await load(session.accessToken, scopeId);
  }

  return (
    <AppShell title="Students">
      <InstitutionScopeBar onChange={setScopeId} />
      <p className="mb-6 text-sm text-slate-600 max-w-2xl">
        Register students for your institution. Name consent controls whether the
        full name appears on public diploma verification.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowForm(!showForm)}
        className="mb-6 rounded-lg bg-renis-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        {showForm ? "Cancel" : "Add student"}
      </button>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm grid gap-4 md:grid-cols-2"
        >
          <label className="block text-sm">
            <span className="text-slate-600">Student ID</span>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
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
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={form.dateOfBirth}
              onChange={(e) =>
                setForm({ ...form, dateOfBirth: e.target.value })
              }
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">First name</span>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Last name</span>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={form.nameConsent}
              onChange={(e) =>
                setForm({ ...form, nameConsent: e.target.checked })
              }
            />
            <span className="text-slate-600">
              Consent to display full name publicly
            </span>
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-renis-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Save student
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
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">DOB</th>
                <th className="px-4 py-3">Name consent</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs">
                    {s.studentIdNumber}
                  </td>
                  <td className="px-4 py-3">
                    {s.firstName} {s.lastName}
                  </td>
                  <td className="px-4 py-3">
                    {s.dateOfBirth
                      ? new Date(s.dateOfBirth).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void toggleConsent(s)}
                      className={
                        s.nameConsent
                          ? "text-green-700 hover:underline"
                          : "text-slate-500 hover:underline"
                      }
                    >
                      {s.nameConsent ? "Yes" : "No"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
