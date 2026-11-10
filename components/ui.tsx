// Pieces repeated on every page. Each piece is written once, here.
import type { ReactNode } from "react";

/** Page header: title, one line of explanation and, on the right, the main action. */
export function PageHeader({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {text ? <p className="page-subtitle">{text}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}

/** Message after an action. Actions go back to the page with ?ok=… or ?error=… */
export function Notice({ ok, error }: { ok?: string; error?: string }) {
  if (error) return <p className="notice notice-bad mb-4" role="alert">{error}</p>;
  if (ok) return <p className="notice notice-ok mb-4" role="status">{ok}</p>;
  return null;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="hint block">{hint}</span> : null}
    </label>
  );
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: process.env.HUB_TIMEZONE || "UTC" });
export const formatDate = (d: Date | string | null | undefined) => (d ? DATE_FORMAT.format(new Date(d)) : "-");

export function timeAgo(d: Date | string | null | undefined): string {
  if (!d) return "never";
  const s = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}
