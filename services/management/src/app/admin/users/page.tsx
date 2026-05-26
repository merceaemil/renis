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
import { useT } from "@/lib/i18n/LocaleProvider";
import type { TranslationKey } from "@/lib/i18n";

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

const roleOptions: { value: UserRole; labelKey: TranslationKey }[] = [
  { value: UserRole.SUPER_ADMIN, labelKey: "role.SUPER_ADMIN" },
  { value: UserRole.MINISTRY_ADMIN, labelKey: "role.MINISTRY_ADMIN" },
  { value: UserRole.INSTITUTION_ADMIN, labelKey: "role.INSTITUTION_ADMIN" },
];

export default function UsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const t = useT();
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
      if (!res.ok) throw new Error(t("users.couldNotLoad"));
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
      setError(data.error ?? t("users.createFailed"));
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
      setError(data.error ?? t("users.updateFailed"));
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
    <AppShell title={t("users.title")}>
      <PageHeader
        description={t("users.description")}
        actions={
          <button
            type="button"
            className="renis-btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            {t("users.create")}
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
        title={t("users.createTitle")}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="renis-btn-secondary" onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </button>
            <button type="submit" form="user-create-form" className="renis-btn-primary">
              {t("users.createSubmit")}
            </button>
          </div>
        }
      >
        <form id="user-create-form" className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
          <label className="block text-sm">
            <span className="text-slate-600">{t("users.field.email")}</span>
            <input
              required
              type="email"
              className="renis-input mt-1"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">{t("users.field.firstName")}</span>
            <input
              required
              className="renis-input mt-1"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">{t("users.field.lastName")}</span>
            <input
              required
              className="renis-input mt-1"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">{t("users.field.role")}</span>
            <select
              className="renis-input mt-1"
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as UserRole })
              }
            >
              {availableRoles.map((r) => (
                <option key={r.value} value={r.value}>
                  {t(r.labelKey)}
                </option>
              ))}
            </select>
          </label>
          {form.role === UserRole.INSTITUTION_ADMIN && isSuperAdmin && (
            <label className="block text-sm md:col-span-2">
              <span className="text-slate-600">
                {t("users.field.institution")}
              </span>
              <select
                required
                className="renis-input mt-1"
                value={form.institutionId}
                onChange={(e) =>
                  setForm({ ...form, institutionId: e.target.value })
                }
              >
                <option value="">{t("users.selectInstitution")}</option>
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
            : t("students.detailTitle")
        }
        description={detailTarget?.email}
        footer={
          detailTarget ? (
            <div className="flex justify-end gap-2">
              <button type="button" className="renis-btn-secondary" onClick={() => setDetailTarget(null)}>
                {t("common.close")}
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
                  ? t("users.deactivate")
                  : t("users.reactivate")}
              </button>
            </div>
          ) : null
        }
      >
        {detailTarget ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{t("users.field.role")}</dt>
              <dd className="text-slate-900">
                {(() => {
                  const opt = roleOptions.find(
                    (r) => r.value === detailTarget.role
                  );
                  return opt ? t(opt.labelKey) : detailTarget.role;
                })()}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("users.field.status")}</dt>
              <dd>
                <StatusBadge status={detailTarget.status} />
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">
                {t("users.field.institution")}
              </dt>
              <dd className="text-slate-900">
                {detailTarget.institution?.name ?? t("common.dash")}
              </dd>
            </div>
          </dl>
        ) : null}
      </Modal>

      {loading ? (
        <p className="text-slate-500 py-8">{t("common.loading")}</p>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          {t("users.empty")}
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
                  {t("users.field.name")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("users.field.email")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("users.field.role")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("users.field.institution")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("users.field.status")}
                </th>
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
                    {(() => {
                      const opt = roleOptions.find((r) => r.value === u.role);
                      return opt ? t(opt.labelKey) : u.role;
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    {u.institution?.name ?? t("common.dash")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-4 py-3">
                    <RowMenu
                      label={t("common.actionsFor", { target: u.email })}
                      items={[
                        {
                          label: t("common.viewDetails"),
                          onClick: () => setDetailTarget(u),
                        },
                        {
                          label:
                            u.status === UserStatus.ACTIVE
                              ? t("users.deactivate")
                              : t("users.reactivate"),
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
