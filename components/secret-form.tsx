"use client";
// Form whose response is a secret shown only once (a token, a device key, an invite link).
// After it is sent, the secret appears in a box to copy; after a reload it is gone.
import { useActionState, useState } from "react";

export type SecretResult = { ok?: boolean; error?: string; secret?: string; title?: string; note?: string; command?: string } | null;
type Action = (previous: SecretResult, data: FormData) => Promise<SecretResult>;

export function SecretForm({ action, button, children, buttonClass = "btn btn-primary", inline = false }: {
  action: Action; button: string; children?: React.ReactNode; buttonClass?: string; inline?: boolean;
}) {
  const [state, submit, pending] = useActionState(action, null);
  const [copied, setCopied] = useState("");
  const copy = async (text: string, which: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(which); } catch { setCopied(""); }
  };
  return (
    <div className={inline ? "inline-block" : ""}>
      <form action={submit} className={inline ? "inline" : "flex flex-wrap items-end gap-3"}>
        {children}
        <button className={buttonClass} type="submit" disabled={pending}>{pending ? "One moment…" : button}</button>
      </form>
      {state?.error ? <p className="notice notice-bad mt-3" role="alert">{state.error}</p> : null}
      {state?.secret ? (
        <div className="mt-3 max-w-[640px] text-left" role="status">
          <p className="mb-1.5 text-[13px] font-medium text-ink">{state.title || "Copy it now: it will not be shown again."}</p>
          <p className="secret-box">{state.secret}</p>
          {state.command ? <><p className="mb-1.5 mt-3 text-[13px] font-medium text-ink">Or paste this command into a terminal:</p><p className="secret-box">{state.command}</p></> : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className="btn" onClick={() => copy(state.secret!, "secret")}>{copied === "secret" ? "Copied" : "Copy"}</button>
            {state.command ? <button type="button" className="btn" onClick={() => copy(state.command!, "command")}>{copied === "command" ? "Copied" : "Copy the command"}</button> : null}
            {state.note ? <span className="hint" style={{ marginTop: 0 }}>{state.note}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
