// Tools that ship with the hub: know who you are, read and write the log, use the connectors
// and send jobs to the devices. They also work as examples for writing the company's own tools.
import { z } from "zod";
import { hub } from "../../hub.config.ts";
import { can, hasAny } from "../permissions.ts";
import { writeLog, searchLog, KINDS } from "../log.ts";
import { listConnectors, METHODS, callConnector } from "../connectors.ts";
import { isOnline, enqueueJob, listDevices } from "../devices.ts";
import { defineTool, type Tool } from "./types.ts";

const timestamp = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : null);

export const CORE_TOOLS: Tool[] = [
  defineTool({
    name: "hub_whoami",
    title: "Who am I in the hub",
    description: "Returns which person and role you are connected as, which permissions you have and the areas of the log. Use it at the start if you do not know what you can do.",
    input: z.object({}),
    permission: "hub:enter",
    visible: () => true,
    permissionFor: () => [],
    readOnly: true,
    skipLog: true,
    run: async (_a, { person }) => ({
      hub: hub.name, person: person.name, email: person.email, role: person.roleName, permissions: person.permissions, areas: hub.areas,
    }),
  }),

  defineTool({
    name: "log_search",
    title: "Search the log",
    description: 'Searches the team\'s activity log. Use it BEFORE changing anything shared, to see whether there is a decision on that topic: if there is one, do not undo it without telling the person who made it. By default it leaves out the automatic "usage" lines; ask for kind "usage" to see them.',
    input: z.object({
      text: z.string().optional().describe("Words to search for in the title and the detail"),
      kind: z.enum(KINDS).optional().describe("decision, change, project, note or usage"),
      area: z.string().optional().describe("One of the hub areas"),
      days: z.number().int().min(1).max(3650).optional().describe("Only the last N days"),
      limit: z.number().int().min(1).max(200).optional().describe("How many lines, 30 by default"),
    }),
    permission: "log:read",
    readOnly: true,
    skipLog: true,
    run: async (a) => (await searchLog({ ...a, limit: a.limit ?? 30, excludeUsage: !a.kind })).map((e) => ({
      id: e.id, at: timestamp(e.created_at), who: e.who, via: e.via, kind: e.kind, area: e.area, title: e.title,
      ...(e.detail ? { detail: e.detail } : {}), ...(e.tool ? { tool: e.tool } : {}), ...(e.ok ? {} : { failed: true }),
    })),
  }),

  defineTool({
    name: "log_add",
    title: "Add to the log",
    description: 'Leaves a line in the log for the rest of the team, when you finish something relevant. "decision": something the others must not undo without talking about it first. "change": something done. "project": a project starts or ends. "note": useful information. One line per thing, written so any colleague understands it. NEVER passwords, keys or personal data of customers.',
    input: z.object({
      kind: z.enum(["decision", "change", "project", "note"]),
      area: z.string().describe("One of the hub areas (hub_whoami lists them)"),
      title: z.string().min(3).max(200).describe("Short title"),
      detail: z.string().max(4000).optional().describe("What and why"),
    }),
    permission: "log:write",
    skipLog: true,
    run: async (a, { person }) => {
      const area = hub.areas.find((x) => x.toLowerCase() === a.area.trim().toLowerCase());
      if (!area) throw new Error(`The area "${a.area}" does not exist. Areas: ${hub.areas.join(", ")}`);
      const id = await writeLog({ person, via: "mcp", kind: a.kind, area, title: a.title, detail: a.detail });
      if (!id) throw new Error("Could not add to the log. Try again.");
      return `Added to the log (${a.kind}, ${area}).`;
    },
  }),

  defineTool({
    name: "connectors_list",
    title: "List connectors",
    description: "Lists the outside services you can use from the hub (identifier, what it is for, base URL and whether you can write). It returns no secrets: the hub adds them for you when you call connector_request.",
    input: z.object({}),
    permission: "connector",
    visible: (p) => hasAny(p, "connector"),
    permissionFor: () => [],
    readOnly: true,
    skipLog: true,
    run: async (_a, { person }) => (await listConnectors())
      .filter((c) => c.active && (can(person.permissions, `connector:${c.slug}:read`) || can(person.permissions, `connector:${c.slug}:write`)))
      .map((c) => ({
        connector: c.slug, name: c.name, description: c.description, base_url: c.base_url || null,
        can_write: can(person.permissions, `connector:${c.slug}:write`),
      })),
  }),

  defineTool({
    name: "connector_request",
    title: "Call a connector",
    description: "Makes an HTTP request to a connector's API. The hub adds the secret: do not ask for it and do not add it yourself. The path is relative to the connector's base URL. GET needs read permission; POST, PUT, PATCH and DELETE need write permission. Before writing or deleting company data, confirm with the person what you are going to change. Every call is written to the log with your name.",
    input: z.object({
      connector: z.string().describe("Connector identifier (connectors_list)"),
      method: z.enum(METHODS).optional().describe("GET by default"),
      path: z.string().describe('API path, starting with "/". For example /v1/contacts'),
      query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional().describe("URL parameters"),
      body: z.unknown().optional().describe("Request body (JSON object or text)"),
      headers: z.record(z.string(), z.string()).optional().describe("Extra headers. Authentication headers are ignored"),
    }),
    permission: "connector",
    visible: (p) => hasAny(p, "connector"),
    permissionFor: (a) => (!a.method || a.method === "GET"
      ? [`connector:${a.connector}:read`, `connector:${a.connector}:write`]
      : [`connector:${a.connector}:write`]),
    run: async (a) => callConnector(a.connector, { method: a.method, path: a.path, query: a.query, body: a.body, headers: a.headers }),
  }),

  defineTool({
    name: "devices_list",
    title: "List devices",
    description: "Lists the physical devices connected to the hub that you can use (printers, readers, cameras...), whether they are online now and how many jobs they have in the queue.",
    input: z.object({}),
    permission: "device",
    visible: (p) => hasAny(p, "device") || can(p, "devices:manage"),
    permissionFor: () => [],
    readOnly: true,
    skipLog: true,
    run: async (_a, { person }) => (await listDevices())
      .filter((d) => d.active && (can(person.permissions, `device:${d.slug}:use`) || can(person.permissions, "devices:manage")))
      .map((d) => ({
        device: d.slug, name: d.name, kind: d.kind, location: d.location, online: isOnline(d),
        last_heartbeat: timestamp(d.last_heartbeat_at), queued_jobs: d.pending, status: d.status,
      })),
  }),

  defineTool({
    name: "device_enqueue",
    title: "Send a job to a device",
    description: "Puts a job in a device's queue (for example, print a label). The device picks it up on its next heartbeat, usually in less than 15 seconds. If the device is not online, the job waits in the queue: tell the person. The kind and the payload depend on what that device's program understands.",
    input: z.object({
      device: z.string().describe("Device identifier (devices_list)"),
      kind: z.string().min(1).max(60).describe('Kind of job the device understands, for example "print"'),
      payload: z.record(z.string(), z.unknown()).optional().describe("Job data"),
    }),
    permission: "device",
    visible: (p) => hasAny(p, "device"),
    permissionFor: (a) => [`device:${a.device}:use`],
    run: async (a, { person }) => {
      const r = await enqueueJob(a.device, a.kind, a.payload ?? {}, person.name);
      return { job: r.id, queued: true, device_online: r.online };
    },
  }),
];
