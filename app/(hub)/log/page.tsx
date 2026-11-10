import { hub } from "@/hub.config.ts";
import { requireAccess } from "@/lib/session.ts";
import { can } from "@/lib/permissions.ts";
import { searchLog, KINDS } from "@/lib/log.ts";
import { Notice, PageHeader, Field } from "@/components/ui.tsx";
import { LogForm, LogList } from "@/components/log.tsx";
import { addLogEntry } from "../actions.ts";

const KIND_NAME: Record<string, string> = { decision: "Decisions", change: "Changes", project: "Projects", note: "Notes", usage: "Automatic usage" };

export default async function Log({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const person = await requireAccess("log:read");
  const q = await searchParams;
  const limit = Math.min(500, Number(q.limit) || 100);
  const entries = await searchLog({ text: q.text, kind: q.kind, area: q.area, days: Number(q.days) || undefined, limit: limit + 1, excludeUsage: !q.kind });
  const more = new URLSearchParams({ ...(q.text ? { text: q.text } : {}), ...(q.kind ? { kind: q.kind } : {}), ...(q.area ? { area: q.area } : {}), limit: String(limit + 100) });
  return (
    <>
      <PageHeader title="Log" text="Who did what. People, their AIs and the hub itself write here, and nothing can be changed or deleted." />
      <Notice ok={q.ok} error={q.error} />
      {can(person.permissions, "log:write") ? (
        <details className="collapsible card mb-5">
          <summary className="card-pad section-title">Add something</summary>
          <div className="px-[18px] pb-[18px]"><LogForm action={addLogEntry} returnTo="/log" /></div>
        </details>
      ) : null}
      <form className="mb-4 grid items-end gap-3 sm:grid-cols-2 md:grid-cols-[1fr_180px_180px_auto]">
        <Field label="Search"><input name="text" defaultValue={q.text} className="field" placeholder="Words from the title or the detail" /></Field>
        <Field label="Kind">
          <select name="kind" defaultValue={q.kind ?? ""} className="field"><option value="">Everything except usage</option>{KINDS.map((k) => <option key={k} value={k}>{KIND_NAME[k]}</option>)}</select>
        </Field>
        <Field label="Area">
          <select name="area" defaultValue={q.area ?? ""} className="field"><option value="">All</option>{hub.areas.map((a) => <option key={a}>{a}</option>)}</select>
        </Field>
        <button className="btn" type="submit">Filter</button>
      </form>
      <section className="card">
        <LogList entries={entries.slice(0, limit)} empty="Nothing matches that filter." />
        {entries.length > limit ? <p className="border-t border-line p-3 text-center"><a className="btn" href={`/log?${more}`}>See more</a></p> : null}
      </section>
    </>
  );
}
