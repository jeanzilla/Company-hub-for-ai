import { requireAccess } from "@/lib/session.ts";
import { listTokens } from "@/lib/people.ts";
import { toolsFor } from "@/lib/mcp/server.ts";
import { hubUrl } from "@/lib/url.ts";
import { Notice, PageHeader, Field, formatDate } from "@/components/ui.tsx";
import { SecretForm } from "@/components/secret-form.tsx";
import { createToken, revokeToken } from "../actions.ts";

export default async function MyAI({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const person = await requireAccess();
  const q = await searchParams;
  const tokens = await listTokens(person.id);
  const tools = toolsFor(person.permissions);
  const mcp = `${hubUrl()}/api/mcp`;
  return (
    <>
      <PageHeader title="My AI" text="Connect your assistant to the hub. It works with the permissions of your role, and everything it does is saved in the log under your name." />
      <Notice ok={q.ok} error={q.error} />

      <section className="card card-pad mb-6">
        <h2 className="section-title mb-1">1. With the hub address</h2>
        <p className="page-subtitle mb-3">In Claude (Settings → Connectors → Add custom connector) or in any program that supports MCP, paste this address. It will ask you to sign in to the hub and give permission.</p>
        <p className="secret-box max-w-[640px]">{mcp}</p>
      </section>

      <section className="card card-pad mb-6">
        <h2 className="section-title mb-1">2. With a token</h2>
        <p className="page-subtitle mb-3">For Claude Code and other terminal programs. The token is personal: do not share it or paste it into a chat.</p>
        <SecretForm action={createToken} button="Create a token">
          <div className="w-full sm:w-64"><Field label="What it is for"><input name="name" className="field" placeholder="Claude Code on my laptop" maxLength={80} /></Field></div>
        </SecretForm>
      </section>

      <section className="card mb-6">
        <h2 className="section-title px-[18px] pb-2 pt-4">Open connections</h2>
        {tokens.length ? (
          <div className="table-wrap"><table className="data-table">
            <thead><tr><th>Name</th><th>How</th><th>Created</th><th>Last used</th><th></th></tr></thead>
            <tbody>{tokens.map((t) => (
              <tr key={t.id}>
                <td className="text-ink">{t.name}</td>
                <td className="text-muted">{t.kind === "personal" ? <>Token <span className="mono">{t.prefix}</span></> : "With the hub address"}</td>
                <td className="num whitespace-nowrap text-muted">{formatDate(t.created_at)}</td>
                <td className="num whitespace-nowrap text-muted">{formatDate(t.last_used_at)}</td>
                <td className="text-right"><form action={revokeToken}><input type="hidden" name="id" value={t.id} /><button className="btn btn-danger" type="submit">Disconnect</button></form></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="empty-state">No AI connected yet.</p>}
      </section>

      <section className="card card-pad">
        <h2 className="section-title mb-1">What your AI can do</h2>
        <p className="page-subtitle mb-3">These are the {tools.length} tools of your role ({person.roleName}). If one is missing, ask whoever manages the hub.</p>
        <ul className="grid gap-3">
          {tools.map((h) => (
            <li key={h.name}><span className="font-medium text-ink">{h.title}</span><span className="mono ml-2 text-faint">{h.name}</span><span className="block text-[13px] text-muted">{h.description.split(". ")[0]}.</span></li>
          ))}
        </ul>
      </section>
    </>
  );
}
