// Dynamic client registration (RFC 7591): the AI program introduces itself, and nobody has to add it by hand.
import { registerClient } from "@/lib/oauth.ts";
import { jsonCors, options } from "@/lib/http.ts";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const client = await registerClient(c.client_name, c.redirect_uris);
    return jsonCors({
      client_id: client.id, client_name: client.name, redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"],
    }, 201);
  } catch (e) {
    return jsonCors({ error: "invalid_client_metadata", error_description: e instanceof Error ? e.message : "Not valid" }, 400);
  }
}
export const OPTIONS = options;
