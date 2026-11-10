// Exchanges an authorization code (with PKCE) or a refresh token for new tokens.
import { exchangeCode, refreshTokens } from "@/lib/oauth.ts";
import { jsonCors, options } from "@/lib/http.ts";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  const c: Record<string, string> = {};
  if (contentType.includes("json")) Object.assign(c, await req.json().catch(() => ({})));
  else for (const [k, v] of new URLSearchParams(await req.text())) c[k] = v;
  try {
    if (c.grant_type === "authorization_code") {
      if (!c.code || !c.client_id || !c.redirect_uri || !c.code_verifier) throw new Error("Missing fields");
      return jsonCors(await exchangeCode({ code: c.code, clientId: c.client_id, redirectUri: c.redirect_uri, verifier: c.code_verifier }));
    }
    if (c.grant_type === "refresh_token") {
      if (!c.refresh_token || !c.client_id) throw new Error("Missing fields");
      return jsonCors(await refreshTokens(c.refresh_token, c.client_id));
    }
    return jsonCors({ error: "unsupported_grant_type" }, 400);
  } catch (e) {
    return jsonCors({ error: "invalid_grant", error_description: e instanceof Error ? e.message : "Not valid" }, 400);
  }
}
export const OPTIONS = options;
