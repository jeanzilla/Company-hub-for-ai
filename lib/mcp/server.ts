// The hub MCP as one person sees it: only the tools of their role, and every call with a permission check and a log line.
import { hub } from "../../hub.config.ts";
import { COMPANY_TOOLS } from "../../tools/index.ts";
import type { Person } from "../people.ts";
import { can } from "../permissions.ts";
import { writeLog, summarizeArgs } from "../log.ts";
import { CORE_TOOLS } from "./core.ts";
import type { McpServer } from "./protocol.ts";
import type { Tool } from "./types.ts";

export const ALL_TOOLS: Tool[] = [...CORE_TOOLS, ...COMPANY_TOOLS];

export function toolsFor(permissions: string[]): Tool[] {
  return ALL_TOOLS.filter((t) => (t.visible ? t.visible(permissions) : can(permissions, t.permission)));
}

const INSTRUCTIONS = `You are connected to the hub of ${hub.name}. ${hub.description}
You work on behalf of a person on the team, with the permissions of their role: hub_whoami tells you which ones.
1. Before changing anything shared, use log_search to check whether there is a decision on that topic.
2. When you finish something relevant, record it with log_add so the rest of the team knows.
3. The secrets of the services are in the hub: use connector_request and never ask the person for a key or password.
4. Before writing or deleting data, say what you are going to change and wait for their approval.`;

export function serverFor(person: Person, via: "mcp" | "web" = "mcp"): McpServer {
  return {
    name: hub.name,
    version: "1.0.0",
    instructions: INSTRUCTIONS,
    tools: () => toolsFor(person.permissions),
    call: async (tool, args) => {
      const requested = tool.permissionFor ? tool.permissionFor(args) : [tool.permission];
      const base = { person, via, kind: "usage" as const, title: tool.title, tool: tool.name, area: tool.area };
      if (requested.length && !requested.some((p) => can(person.permissions, p))) {
        await writeLog({ ...base, ok: false, detail: `No permission: ${requested.join(" or ")}`, data: { arguments: summarizeArgs(args) } });
        throw new Error(`Your role (${person.roleName}) does not have permission for this. Needed: ${requested.join(" or ")}. Ask whoever manages the hub.`);
      }
      const t0 = Date.now();
      try {
        const r = await tool.run(args, { person, via });
        if (!tool.skipLog) await writeLog({ ...base, data: { arguments: summarizeArgs(args), ms: Date.now() - t0 } });
        return r;
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        await writeLog({ ...base, ok: false, detail, data: { arguments: summarizeArgs(args), ms: Date.now() - t0 } });
        throw e;
      }
    },
  };
}
