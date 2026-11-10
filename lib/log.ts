// Activity log: who did what, through which channel and when. The table accepts no changes and no deletions.
import { query, json } from "./db.ts";

export const KINDS = ["usage", "decision", "change", "project", "note"] as const;
export type Kind = (typeof KINDS)[number];
export type Via = "web" | "mcp" | "device" | "system";

export type LogEntry = {
  id: string; created_at: Date; person_id: string | null; who: string; via: Via; kind: Kind;
  area: string; title: string; detail: string; tool: string; data: Record<string, unknown>; ok: boolean;
};

export type LogInput = {
  person?: { id: string; name: string } | null;
  who?: string;
  via: Via; kind: Kind; title: string;
  area?: string; detail?: string; tool?: string; data?: Record<string, unknown>; ok?: boolean;
};

const clip = (t: unknown, max: number) => String(t ?? "").slice(0, max);

/** Writes one line to the log. If it fails, it does not break the action that was being logged. */
export async function writeLog(a: LogInput): Promise<string | null> {
  try {
    const rows = await query<{ id: string }>(
      `insert into log (person_id, who, via, kind, area, title, detail, tool, data, ok)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10) returning id`,
      [a.person?.id ?? null, clip(a.who ?? a.person?.name, 120), a.via, a.kind, clip(a.area, 60), clip(a.title, 200),
       clip(a.detail, 4000), clip(a.tool, 80), json(a.data ?? {}), a.ok ?? true]);
    return rows[0]?.id ?? null;
  } catch (e) {
    console.error("[log] could not write:", e instanceof Error ? e.message : e);
    return null;
  }
}

export type LogFilter = { text?: string; kind?: string; area?: string; person?: string; days?: number; limit?: number; excludeUsage?: boolean };

export async function searchLog(f: LogFilter = {}): Promise<LogEntry[]> {
  const cond: string[] = [], p: unknown[] = [];
  const add = (sqlCond: string, value: unknown) => { p.push(value); cond.push(sqlCond.replace("?", `$${p.length}`)); };
  if (f.text) add("(title || ' ' || detail || ' ' || tool) ilike ?", `%${f.text.replace(/[%_\\]/g, "\\$&")}%`);
  if (f.kind && (KINDS as readonly string[]).includes(f.kind)) add("kind = ?", f.kind);
  if (f.excludeUsage) cond.push("kind <> 'usage'");
  if (f.area) add("lower(area) = lower(?)", f.area);
  if (f.person) add("person_id = ?::uuid", f.person);
  if (f.days) add("created_at > now() - make_interval(days => ?::int)", Math.min(3650, Math.max(1, Math.round(f.days))));
  p.push(Math.min(500, Math.max(1, Math.round(f.limit ?? 50))));
  return query<LogEntry>(
    `select id, created_at, person_id, who, via, kind, area, title, detail, tool, data, ok
       from log ${cond.length ? `where ${cond.join(" and ")}` : ""} order by created_at desc, id desc limit $${p.length}`, p);
}

/** Removes from the arguments of a call anything that looks like a secret and shortens long values, before storing them. */
export function summarizeArgs(args: unknown, max = 600): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!args || typeof args !== "object") return out;
  for (const [k, v] of Object.entries(args as Record<string, unknown>)) {
    if (/(^|_)key$|api_?key|secret|token|password|authorization/i.test(k)) { out[k] = "[hidden]"; continue; }
    const t = typeof v === "string" ? v : JSON.stringify(v);
    out[k] = t === undefined ? null : t.length > max ? `${t.slice(0, max)}… (${t.length} characters)` : v;
  }
  return out;
}
