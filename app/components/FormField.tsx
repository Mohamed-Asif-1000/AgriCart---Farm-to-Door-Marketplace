import { AlertCircle, CheckCircle2 } from "lucide-react";

// Shared form-validation presentation so the checkout and auth forms render
// identical field states. Each form owns its own validate() function and only
// borrows the shell, so the rules stay local to the screen that defines them.

export function fieldClass(showError: boolean, error: string | null) {
  return [
    "w-full p-3 rounded-xl border bg-white text-slate-900 transition outline-none focus:ring-2",
    showError && error
      ? "border-red-400 focus:ring-red-200"
      : "border-slate-300 focus:ring-emerald-500 focus:ring-emerald-200",
  ].join(" ");
}

export function FieldShell({
  id,
  label,
  error,
  showError,
  className = "",
  children,
}: {
  id: string;
  label: string;
  error: string | null;
  showError: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-slate-700 mb-1.5"
      >
        {label}
      </label>
      {children}
      {showError && error ? (
        <p
          id={`${id}-error`}
          className="mt-1.5 text-sm text-red-600 flex items-center gap-1"
        >
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormBanner({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  const isError = tone === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <div
      role={isError ? "alert" : "status"}
      className={`flex items-start gap-2 px-4 py-3 rounded-xl text-sm font-semibold ${
        isError
          ? "bg-red-50 text-red-700 border border-red-200"
          : "bg-emerald-50 text-emerald-800 border border-emerald-200"
      }`}
    >
      <Icon size={16} className="shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}
