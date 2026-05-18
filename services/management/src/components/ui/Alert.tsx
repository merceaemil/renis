type AlertProps = {
  variant: "error" | "success" | "info" | "warning";
  children: React.ReactNode;
  onDismiss?: () => void;
};

const styles = {
  error: "bg-red-50 border-red-200 text-red-800",
  success: "bg-green-50 border-green-200 text-green-800",
  info: "bg-sky-50 border-sky-200 text-sky-900",
  warning: "bg-amber-50 border-amber-200 text-amber-900",
};

export function Alert({ variant, children, onDismiss }: AlertProps) {
  return (
    <div
      className={`mb-4 flex gap-3 rounded-lg border px-4 py-3 text-sm ${styles[variant]}`}
      role="alert"
    >
      <div className="flex-1">{children}</div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
