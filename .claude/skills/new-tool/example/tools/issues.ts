// Issues: the logic (database) and the tools for the AI. The screen is in app/(hub)/issues.
// The screen and the AI call the same functions, so both do exactly the same thing.
import { z } from "zod";
import { query } from "../lib/db.ts";
import { defineTool, type Tool } from "../lib/mcp/types.ts";

export const PERMISSION = "tool:issues";

export type Issue = {
  id: string; title: string; detail: string; status: "open" | "resolved";
  created_by: string; created_at: Date; resolved_by: string; resolved_at: Date | null;
};

export async function listIssues(status?: "open" | "resolved"): Promise<Issue[]> {
  return query<Issue>(
    `select * from issues where ($1::text is null or status = $1) order by status, created_at desc limit 200`, [status ?? null]);
}

export async function createIssue(title: string, detail: string, by: string): Promise<string> {
  if (title.trim().length < 3) throw new Error("The title is too short. Say what is wrong.");
  const rows = await query<{ id: string }>(`insert into issues (title, detail, created_by) values ($1, $2, $3) returning id`,
    [title.trim().slice(0, 200), detail.trim().slice(0, 2000), by]);
  return rows[0].id;
}

export async function resolveIssue(id: string, by: string): Promise<boolean> {
  const rows = await query(`update issues set status = 'resolved', resolved_by = $2, resolved_at = now() where id = $1::bigint and status = 'open' returning id`, [id, by]);
  return rows.length > 0;
}

export const ISSUES: Tool[] = [
  defineTool({
    name: "issues_list",
    title: "List issues",
    description: "Lists the issues on the premises or at work (something broken, something missing). By default, only the open ones. Use it when someone asks what is waiting to be fixed.",
    input: z.object({ status: z.enum(["open", "resolved"]).optional().describe("Without this field, the open ones") }),
    permission: PERMISSION,
    readOnly: true,
    skipLog: true,
    run: async (a) => (await listIssues(a.status ?? "open")).map((i) => ({
      id: i.id, title: i.title, detail: i.detail, status: i.status, by: i.created_by, since: i.created_at.toISOString().slice(0, 10),
    })),
  }),
  defineTool({
    name: "issue_create",
    title: "Report an issue",
    description: "Reports something that is broken so that someone fixes it. The title says what is wrong and where, in one line. Check first with issues_list that it has not been reported already.",
    input: z.object({
      title: z.string().min(3).max(200).describe('What is wrong and where: "The warehouse printer will not feed paper"'),
      detail: z.string().max(2000).optional().describe("Since when, what has been tried"),
    }),
    permission: PERMISSION,
    area: "Operations",
    run: async (a, { person }) => ({ id: await createIssue(a.title, a.detail ?? "", person.name), created: true }),
  }),
  defineTool({
    name: "issue_resolve",
    title: "Mark an issue as resolved",
    description: "Marks an issue as resolved. Do it only when the person confirms to you that it is fixed.",
    input: z.object({ id: z.string().regex(/^\d+$/).describe("Issue number (from issues_list)") }),
    permission: PERMISSION,
    area: "Operations",
    run: async (a, { person }) => {
      if (!(await resolveIssue(a.id, person.name))) throw new Error("That issue does not exist or was already resolved");
      return "Resolved.";
    },
  }),
];
