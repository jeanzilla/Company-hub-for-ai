// MCP protocol over HTTP, stateless: each request is one JSON-RPC message and gets its response.
// This file knows nothing about the database or permissions: it receives a "server" already prepared for one person.
import { z } from "zod";
import type { Tool } from "./types.ts";

export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

export type McpServer = {
  name: string;
  version: string;
  instructions: string;
  /** The tools this person can see. */
  tools: () => Tool[];
  /** Runs a tool that has already been validated. The permission check and the log happen in here. */
  call: (tool: Tool, args: unknown) => Promise<unknown>;
};

type Message = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
const failure = (id: Message["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const textResult = (t: string, isError = false) => ({ content: [{ type: "text", text: t }], ...(isError ? { isError: true } : {}) });

export function toolDefinition(tool: Tool) {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: z.toJSONSchema(tool.input, { target: "draft-7" }),
    annotations: { title: tool.title, readOnlyHint: !!tool.readOnly },
  };
}

/** Handles one message. Returns the response, or null if it was a notification (which gets no response). */
export async function handleMessage(body: unknown, s: McpServer): Promise<unknown | null> {
  if (Array.isArray(body)) {
    const all = (await Promise.all(body.map((m) => handleMessage(m, s)))).filter((r) => r !== null);
    return all.length ? all : null;
  }
  const m = (body && typeof body === "object" ? body : {}) as Message;
  if (m.jsonrpc !== "2.0" || typeof m.method !== "string") return failure(m.id, -32600, "Invalid JSON-RPC message");
  const { id, method, params = {} } = m;
  if (id === undefined || method.startsWith("notifications/")) return null;
  const success = (result: unknown) => ({ jsonrpc: "2.0", id, result });

  if (method === "initialize") {
    const requested = String(params.protocolVersion || "");
    return success({
      protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: s.name, version: s.version },
      instructions: s.instructions,
    });
  }
  if (method === "ping") return success({});
  if (method === "tools/list") return success({ tools: s.tools().map(toolDefinition) });
  if (method === "tools/call") {
    const tool = s.tools().find((x) => x.name === params.name);
    if (!tool) return failure(id, -32602, `You have no tool named "${String(params.name)}"`);
    const args = tool.input.safeParse(params.arguments ?? {});
    if (!args.success) {
      const errors = args.error.issues.map((i) => `${i.path.join(".") || "arguments"}: ${i.message}`).join("; ");
      return success(textResult(`Invalid arguments. ${errors}`, true));
    }
    try {
      const r = await s.call(tool, args.data);
      return success(textResult(typeof r === "string" ? r : JSON.stringify(r ?? null, null, 2)));
    } catch (e) {
      return success(textResult(e instanceof Error ? e.message : String(e), true));
    }
  }
  return failure(id, -32601, `Method not supported: ${method}`);
}
