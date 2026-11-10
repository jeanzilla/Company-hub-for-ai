import { jsonCors, options } from "@/lib/http.ts";
import { hubUrl } from "@/lib/url.ts";

export const dynamic = "force-dynamic";

/** Metadata of the hub's authorization server (RFC 8414). */
export function GET(req: Request) {
  const hub = hubUrl(req);
  return jsonCors({
    issuer: hub,
    authorization_endpoint: `${hub}/oauth/authorize`,
    token_endpoint: `${hub}/api/oauth/token`,
    registration_endpoint: `${hub}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["hub"],
  });
}
export const OPTIONS = options;
