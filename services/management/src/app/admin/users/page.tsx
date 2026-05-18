"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserRole, UserStatus } from "@renis/core/roles";
import { canAccessUserManagement } from "@renis/core/permissions";
import { AppShell } from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  institution?: { id: string; name: string; code: string } | null;
};

type Institution = { id: string; name: string; code: string };

const roleOptions: { value: UserRole; label: string }[] = [
  { value: UserRole.SUPER_ADMIN, label: "Super Admin" },
  { value: UserRole.MINISTRY_ADMIN, label: "Ministry Admin" },
  { value: UserRole.INSTITUTION_ADMIN, label: "Institution Admin" },
];

export default function UsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: UserRole.INSTITUTION_ADMIN as UserRole,
    institutionId: "",
  });

  const isSuperAdmin = session?.user?.role === UserRole.SUPER_ADMIN;

  useEffect(() => {
    if (session && !canAccessUserManagement(session.user?.role)) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  useEffect(() => {
    if (session?.accessToken) void load(session.accessToken);
  }, [session?.accessToken]);

  async function load(accessToken: string) {
    setLoading(true);
    try {
      const [uRes, iRes] = await Promise.all([
        apiFetch("/api/users", { accessToken }),
        apiFetch("/api/institutions", { accessToken }),
      ]);
      if (!uRes.ok) throw new Error("Could not load users");
      setUsers(await uRes.json());
      if (iRes.ok) setInstitutions(await iRes.json());
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
    const res = await apiFetch("/api/users", {
      method: "POST",
      accessToken: session.accessToken,
      body: JSON.stringify({
        ...form,
        institutionId:
          form.role === UserRole.INSTITUTION_ADMIN
            ? form.institutionId || null
            : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Creation failed");
      return;
    }
    setShowForm(false);
    setForm({
      email: "",
      firstName: "",
      lastName: "",
      role: UserRole.INSTITUTION_ADMIN,
      institutionId: "",
    });
    await load(session.accessToken);
  }

  async function toggleStatus(user: UserRow) {
    if (!session?.accessToken) return;
    const next =
      user.status === UserStatus.ACTIVE
        ? UserStatus.INACTIVE
        : UserStatus.ACTIVE;
    const res = await apiFetch(`/api/users/${user.id}`, {
      method: "PATCH",
      accessToken: session.accessToken,
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Update failed");
      return;
    }
    await load(session.accessToken);
  }

  const availableRoles = isSuperAdmin
    ? roleOptions
    : roleOptions.filter((r) => r.value === UserRole.INSTITUTION_ADMIN);

  return (
    <AppShell title="User accounts">
      <p className="mb-6 text-sm text-slate-600 max-w-2xl">
        All accounts are created here: Keycloak provisioning, RENIS database
        record, then invitation email with a temporary password.
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
        {showForm ? "Cancel" : "Create account"}
      </button>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm grid gap-4 md:grid-cols-2"
        >
          <label className="block text-sm">
            <span className="text-slate-600">Email</span>
            <input
              required
              type="email"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
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
          <label className="block text-sm">
            <span className="text-slate-600">Role</span>
            <select
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as UserRole })
              }
            >
              {availableRoles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {form.role === UserRole.INSTITUTION_ADMIN && isSuperAdmin && (
            <label className="block text-sm md:col-span-2">
              <span className="text-slate-600">Institution</span>
              <select
                required
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={form.institutionId}
                onChange={(e) =>
                  setForm({ ...form, institutionId: e.target.value })
                }
              >
                <option value="">— Select —</option>
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.code})
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-renis-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Create and send invitation
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
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Institution</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    {roleOptions.find((r) => r.value === u.role)?.label ?? u.role}
                  </td>
                  <td className="px-4 py-3">{u.institution?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        u.status === UserStatus.ACTIVE
                          ? "text-green-700"
                          : "text-slate-400"
                      }
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void toggleStatus(u)}
                      className="text-renis-primary hover:underline text-xs"
                    >
                      {u.status === UserStatus.ACTIVE
                        ? "Deactivate"
                        : "Reactivate"}
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
