// The hub's MCP. An AI connects here with a person's token (personal or obtained through OAuth) and sees only
// the tools of that person's role. Stateless HTTP transport: each POST carries one message and gets its response.
import { personFromToken } from "@/lib/people.ts";
import { handleMessage } from "@/lib/mcp/protocol.ts";
import { serverFor } from "@/lib/mcp/server.ts";
import { bearer, CORS, jsonCors, options } from "@/lib/http.ts";
import { hubUrl } from "@/lib/url.ts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const person = await personFromToken(bearer(req));
  if (!person) {
    return jsonCors({ jsonrpc: "2.0", id: null, error: { code: -32001, message: 'You need to sign in: connect your AI from "My AI" in the hub' } }, 401,
      { "WWW-Authenticate": `Bearer resource_metadata="${hubUrl(req)}/.well-known/oauth-protected-resource"` });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return jsonCors({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "The body is not JSON" } }, 400); }
  const response = await handleMessage(body, serverFor(person));
  if (response === null) return new Response(null, { status: 202, headers: CORS });
  return jsonCors(response);
}

// There is no channel for server-to-client notifications: POST only.
export const GET = () => new Response(null, { status: 405, headers: { ...CORS, Allow: "POST" } });
export const OPTIONS = options;
