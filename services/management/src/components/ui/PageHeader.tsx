import type { ReactNode } from "react";

export function PageHeader({
  description,
  actions,
}: {
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      {description ? (
        <div className="text-sm text-slate-600 max-w-2xl">{description}</div>
      ) : (
        <div />
      )}
      {actions ? <div className="flex flex-wrap gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}
