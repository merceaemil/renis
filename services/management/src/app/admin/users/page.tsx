"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserRole, UserStatus } from "@renis/core/roles";
import { canAccessUserManagement } from "@renis/core/permissions";
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
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<UserRow | null>(null);
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

  const fetchPage = useCallback(
    async (page: number, pageSize: number) => {
      if (!session?.accessToken) throw new Error("Not signed in");
      const res = await apiFetch(listApiUrl("/api/users", page, pageSize), {
        accessToken: session.accessToken,
      });
      if (!res.ok) throw new Error("Could not load users");
      return normalizeListResponse<UserRow>(await res.json());
    },
    [session?.accessToken]
  );

  const {
    items: users,
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

  useEffect(() => {
    if (!session?.accessToken) return;
    void (async () => {
      const res = await apiFetch("/api/institutions?all=true", {
        accessToken: session.accessToken,
      });
      if (res.ok) {
        const data = normalizeListResponse<Institution>(await res.json());
        setInstitutions(data.items);
      }
    })();
  }, [session?.accessToken]);

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
    setCreateOpen(false);
    setForm({
      email: "",
      firstName: "",
      lastName: "",
      role: UserRole.INSTITUTION_ADMIN,
      institutionId: "",
    });
    await reload();
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
    if (detailTarget?.id === user.id) {
      setDetailTarget({ ...user, status: next });
    }
    await reload();
  }

  const availableRoles = isSuperAdmin
    ? roleOptions
    : roleOptions.filter((r) => r.value === UserRole.INSTITUTION_ADMIN);

  return (
    <AppShell title="User accounts">
      <PageHeader
        description="All accounts are created here: Keycloak provisioning, RENIS database record, then invitation email with a temporary password."
        actions={
          <button
            type="button"
            className="renis-btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            Create account
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
        title="Create account"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="renis-btn-secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="user-create-form" className="renis-btn-primary">
              Create and send invitation
            </button>
          </div>
        }
      >
        <form id="user-create-form" className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
          <label className="block text-sm">
            <span className="text-slate-600">Email</span>
            <input
              required
              type="email"
              className="renis-input mt-1"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
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
          <label className="block text-sm">
            <span className="text-slate-600">Role</span>
            <select
              className="renis-input mt-1"
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
                className="renis-input mt-1"
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
        </form>
      </Modal>

      <Modal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title={
          detailTarget
            ? `${detailTarget.firstName} ${detailTarget.lastName}`
            : "User"
        }
        description={detailTarget?.email}
        footer={
          detailTarget ? (
            <div className="flex justify-end gap-2">
              <button type="button" className="renis-btn-secondary" onClick={() => setDetailTarget(null)}>
                Close
              </button>
              <button
                type="button"
                className={
                  detailTarget.status === UserStatus.ACTIVE
                    ? "renis-btn-danger"
                    : "renis-btn-primary"
                }
                onClick={() => void toggleStatus(detailTarget)}
              >
                {detailTarget.status === UserStatus.ACTIVE
                  ? "Deactivate"
                  : "Reactivate"}
              </button>
            </div>
          ) : null
        }
      >
        {detailTarget ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Role</dt>
              <dd className="text-slate-900">
                {roleOptions.find((r) => r.value === detailTarget.role)?.label ??
                  detailTarget.role}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd>
                <StatusBadge status={detailTarget.status} />
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Institution</dt>
              <dd className="text-slate-900">
                {detailTarget.institution?.name ?? "—"}
              </dd>
            </div>
          </dl>
        ) : null}
      </Modal>

      {loading ? (
        <p className="text-slate-500 py-8">Loading…</p>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          No user accounts yet.
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
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Institution</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="renis-table-row"
                  onClick={() => setDetailTarget(u)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    {roleOptions.find((r) => r.value === u.role)?.label ?? u.role}
                  </td>
                  <td className="px-4 py-3">{u.institution?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-4 py-3">
                    <RowMenu
                      label={`Actions for ${u.email}`}
                      items={[
                        { label: "View details", onClick: () => setDetailTarget(u) },
                        {
                          label:
                            u.status === UserStatus.ACTIVE
                              ? "Deactivate"
                              : "Reactivate",
                          variant:
                            u.status === UserStatus.ACTIVE ? "danger" : "default",
                          onClick: () => void toggleStatus(u),
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
