"use client";

import { UserRole } from "@renis/core/roles";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const STORAGE_KEY = "renis-super-admin-institution-id";

export type Institution = { id: string; code: string; name: string };

export function readScopedInstitutionId(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(STORAGE_KEY) ?? "";
}

export function InstitutionScopeBar({
  onChange,
}: {
  onChange?: (institutionId: string) => void;
}) {
  const { data: session } = useSession();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selected, setSelected] = useState(() =>
    typeof window !== "undefined" ? readScopedInstitutionId() : ""
  );

  const isSuperAdmin = session?.user?.role === UserRole.SUPER_ADMIN;

  useEffect(() => {
    if (!isSuperAdmin || !session?.accessToken) return;
    void apiFetch("/api/institutions", {
      accessToken: session.accessToken,
    }).then(async (res) => {
      if (res.ok) setInstitutions(await res.json());
    });
  }, [isSuperAdmin, session?.accessToken]);

  useEffect(() => {
    onChange?.(selected);
  }, [selected, onChange]);

  if (!isSuperAdmin) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
      <span className="text-amber-900 font-medium">Institution scope</span>
      <select
        className="rounded border border-amber-300 bg-white px-3 py-1.5 min-w-[220px]"
        value={selected}
        onChange={(e) => {
          const v = e.target.value;
          setSelected(v);
          if (v) sessionStorage.setItem(STORAGE_KEY, v);
          else sessionStorage.removeItem(STORAGE_KEY);
        }}
      >
        <option value="">All institutions</option>
        {institutions.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name} ({i.code})
          </option>
        ))}
      </select>
      <span className="text-amber-800 text-xs">
        Lists respect this filter. Pick one institution before creating records.
      </span>
    </div>
  );
}

export function scopedInstitutionIdForCreate(): string | null {
  const id = readScopedInstitutionId();
  return id || null;
}
