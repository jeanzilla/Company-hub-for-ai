import { jsonCors, options } from "@/lib/http.ts";
import { hubUrl } from "@/lib/url.ts";

export const dynamic = "force-dynamic";

/** Tells an AI where to ask for permission to use the hub's MCP (RFC 9728). */
export function GET(req: Request) {
  const hub = hubUrl(req);
  return jsonCors({ resource: `${hub}/api/mcp`, authorization_servers: [hub], bearer_methods_supported: ["header"], scopes_supported: ["hub"] });
}
export const OPTIONS = options;
