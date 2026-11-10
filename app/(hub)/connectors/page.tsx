import { requireAccess } from "@/lib/session.ts";
import { encryptionAvailable } from "@/lib/crypto.ts";
import { listConnectors, type Connector } from "@/lib/connectors.ts";
import { Notice, PageHeader, Field, formatDate } from "@/components/ui.tsx";
import { deleteConnector, saveConnector } from "../actions.ts";

const AUTH: Record<string, string> = {
  none: "No secret", bearer: "Authorization: Bearer header", header: "Another header", query: "Parameter in the URL", basic: "Username and password (Basic)",
};

function ConnectorForm({ c }: { c?: Connector }) {
  return (
    <form action={saveConnector} className="grid gap-3 sm:grid-cols-2">
      <Field label="ID" hint={c ? undefined : "Lowercase, no spaces. The AI uses it to name the connector."}>
        <input name="slug" className="field mono" defaultValue={c?.slug} readOnly={!!c} required pattern="[a-z][a-z0-9_-]{1,39}" placeholder="accounting" />
      </Field>
      <Field label="Name"><input name="name" className="field" defaultValue={c?.name} required placeholder="Accounting software" /></Field>
      <div className="sm:col-span-2">
        <Field label="What it is for" hint="The AI reads this text to decide when to use it. Say what is inside and what it must not touch.">
          <textarea name="description" className="field" defaultValue={c?.description} placeholder="Invoices, contacts and products. Before creating or changing an invoice, confirm with the person." />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Base address of its API" hint="Requests cannot go outside this address.">
          <input name="base_url" className="field mono" defaultValue={c?.base_url} placeholder="https://api.example.com/v1" />
        </Field>
      </div>
      <Field label="Where the secret goes">
        <select name="auth_type" className="field" defaultValue={c?.auth_type ?? "bearer"}>{Object.entries(AUTH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </Field>
      <Field label="Name of the header or the parameter" hint={'Only for "Another header" (for example X-Api-Key) or "Parameter in the URL".'}>
        <input name="auth_name" className="field mono" defaultValue={c?.auth_name} placeholder="X-Api-Key" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Secret" hint={c?.has_secret ? `Saved, ends in "${c.secret_hint}". Leave it empty to keep it.` : "It is stored encrypted and is not shown again. For a username and password, type username:password."}>
          <input name="secret" type="password" className="field mono" autoComplete="new-password" placeholder={c?.has_secret ? "••••••••" : ""} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[13.5px] sm:col-span-2"><input type="checkbox" name="active" defaultChecked={c?.active ?? true} /> Active</label>
      <div className="sm:col-span-2"><button className="btn btn-primary" type="submit">Save</button></div>
    </form>
  );
}

export default async function Connectors({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAccess("connectors:manage");
  const q = await searchParams;
  const connectors = await listConnectors();
  return (
    <>
      <PageHeader title="Connectors" text="The services the company uses. The secret of each one stays in the hub: people and their AIs use it without seeing it, and every use is saved in the log." />
      <Notice ok={q.ok} error={q.error} />
      {!encryptionAvailable() ? <p className="notice notice-warn mb-4">HUB_ENCRYPTION_KEY is missing on the server: secrets cannot be saved until it is set. See .env.example.</p> : null}
      <div className="grid gap-3">
        {connectors.map((c) => (
          <details key={c.slug} className="collapsible card">
            <summary className="card-pad flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0"><span className="font-medium text-ink">{c.name}</span><span className="mono ml-2 text-faint">{c.slug}</span><span className="block truncate text-[13px] text-muted">{c.base_url || "No address"}</span></span>
              <span className="flex items-center gap-2">
                {c.auth_type !== "none" && !c.has_secret ? <span className="chip chip-warn">Secret missing</span> : null}
                <span className={c.active ? "chip chip-ok" : "chip"}>{c.active ? "Active" : "Off"}</span>
              </span>
            </summary>
            <div className="border-t border-line p-[18px]">
              <ConnectorForm c={c} />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <span className="text-[12.5px] text-muted">Last change: {formatDate(c.updated_at)}{c.updated_by ? `, ${c.updated_by}` : ""}. Permissions: <span className="mono">connector:{c.slug}:read</span> and <span className="mono">connector:{c.slug}:write</span>.</span>
                <form action={deleteConnector}><input type="hidden" name="slug" value={c.slug} /><button className="btn btn-danger" type="submit">Delete</button></form>
              </div>
            </div>
          </details>
        ))}
        {!connectors.length ? <p className="card empty-state">No connectors yet. Add the first one: for example, the accounting software or the CRM.</p> : null}
        <details className="collapsible card" open={!connectors.length}>
          <summary className="card-pad font-medium text-accent">Add a connector</summary>
          <div className="border-t border-line p-[18px]"><ConnectorForm /></div>
        </details>
      </div>
    </>
  );
}
