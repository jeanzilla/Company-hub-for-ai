import { requireAccess } from "@/lib/session.ts";
import { listIssues, PERMISSION } from "@/tools/issues.ts";
import { Notice, PageHeader, Field, formatDate } from "@/components/ui.tsx";
import { create, resolve } from "./actions.ts";

export default async function Issues({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAccess(PERMISSION);
  const q = await searchParams;
  const all = await listIssues();
  const open = all.filter((i) => i.status === "open");
  const resolved = all.filter((i) => i.status === "resolved").slice(0, 20);
  return (
    <>
      <PageHeader title="Issues" text="Things that are broken on the premises or at work. Report them here so they are not forgotten in a hallway chat." />
      <Notice ok={q.ok} error={q.error} />

      <section className="card card-pad mb-6">
        <h2 className="section-title mb-3">Report an issue</h2>
        <form action={create} className="grid gap-3">
          <Field label="What is wrong and where"><input name="title" className="field" required minLength={3} maxLength={200} placeholder="The warehouse printer will not feed paper" /></Field>
          <Field label="Detail (optional)"><textarea name="detail" className="field" maxLength={2000} placeholder="Since when, what has been tried" /></Field>
          <div><button className="btn btn-primary" type="submit">Report</button></div>
        </form>
      </section>

      <section className="card mb-6">
        <h2 className="section-title px-[18px] pb-2 pt-4">Open <span className="chip chip-warn num ml-1">{open.length}</span></h2>
        {open.length ? (
          <div className="table-wrap"><table className="data-table">
            <thead><tr><th>Since</th><th>What is wrong</th><th>Reported by</th><th></th></tr></thead>
            <tbody>{open.map((i) => (
              <tr key={i.id}>
                <td className="num whitespace-nowrap text-muted">{formatDate(i.created_at)}</td>
                <td className="min-w-[220px]"><span className="text-ink">{i.title}</span>{i.detail ? <span className="block whitespace-pre-line text-[13px] text-muted">{i.detail}</span> : null}</td>
                <td className="whitespace-nowrap text-muted">{i.created_by}</td>
                <td className="text-right"><form action={resolve}><input type="hidden" name="id" value={i.id} /><button className="btn" type="submit">Mark resolved</button></form></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="empty-state">Nothing open. If something is broken, report it above.</p>}
      </section>

      {resolved.length ? (
        <details className="collapsible card">
          <summary className="card-pad section-title">Recently resolved</summary>
          <div className="table-wrap border-t border-line"><table className="data-table">
            <tbody>{resolved.map((i) => (
              <tr key={i.id}><td className="num whitespace-nowrap text-muted">{formatDate(i.resolved_at)}</td><td>{i.title}</td><td className="whitespace-nowrap text-muted">{i.resolved_by}</td></tr>
            ))}</tbody>
          </table></div>
        </details>
      ) : null}
    </>
  );
}
