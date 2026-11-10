// Log list and the form to add an entry. Used on Home and on Log.
import { hub } from "@/hub.config.ts";
import type { LogEntry } from "@/lib/log.ts";
import { Field, formatDate } from "./ui.tsx";

const CHIP: Record<string, string> = { decision: "chip chip-accent", change: "chip chip-ok", project: "chip chip-warn", note: "chip", usage: "chip chip-plain" };
const KIND_NAME: Record<string, string> = { decision: "Decision", change: "Change", project: "Project", note: "Note", usage: "Usage" };
const VIA: Record<string, string> = { web: "In the hub", mcp: "With their AI", device: "Device", system: "System" };

export function LogList({ entries, empty }: { entries: LogEntry[]; empty: string }) {
  if (!entries.length) return <p className="empty-state">{empty}</p>;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr><th>When</th><th>Who</th><th>Kind</th><th>Area</th><th>What</th></tr></thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td className="num whitespace-nowrap text-muted">{formatDate(e.created_at)}</td>
              <td className="whitespace-nowrap"><span className="text-ink">{e.who || "-"}</span><span className="block text-[12px] text-faint">{VIA[e.via]}</span></td>
              <td><span className={e.ok ? CHIP[e.kind] : "chip chip-bad"}>{e.ok ? KIND_NAME[e.kind] : "Failed"}</span></td>
              <td className="whitespace-nowrap text-muted">{e.area || "-"}</td>
              <td className="min-w-[240px]">
                <span className="text-ink">{e.title}</span>
                {e.tool ? <span className="mono ml-2 text-faint">{e.tool}</span> : null}
                {e.detail ? <span className="mt-0.5 block whitespace-pre-line text-[13px] text-muted">{e.detail}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LogForm({ action, returnTo }: { action: (f: FormData) => Promise<void>; returnTo: string }) {
  return (
    <form action={action} className="grid gap-3 md:grid-cols-[150px_170px_1fr]">
      <input type="hidden" name="returnTo" value={returnTo} />
      <Field label="Kind">
        <select name="kind" className="field" defaultValue="change" required>
          <option value="decision">Decision</option><option value="change">Change</option><option value="project">Project</option><option value="note">Note</option>
        </select>
      </Field>
      <Field label="Area">
        <select name="area" className="field" defaultValue={hub.areas[0]}>{hub.areas.map((a) => <option key={a}>{a}</option>)}</select>
      </Field>
      <Field label="Title"><input name="title" className="field" required minLength={3} maxLength={200} placeholder="One line that any coworker can understand" /></Field>
      <div className="md:col-span-3"><Field label="Detail (optional)"><textarea name="detail" className="field" maxLength={4000} placeholder="What and why. No passwords or secret keys, and no personal data about customers." /></Field></div>
      <div className="md:col-span-3"><button className="btn btn-primary" type="submit">Add to the log</button></div>
    </form>
  );
}
