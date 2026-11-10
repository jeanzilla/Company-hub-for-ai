// OAuth 2.1 so an AI can connect to the hub MCP with one click: the person pastes the hub address into their
// app, signs in with their account and grants access. Dynamic client registration and PKCE (S256), no client secrets.
import { createHash, randomBytes } from "node:crypto";
import { query, queryOne } from "./db.ts";
import { fingerprint, newSecret, prefixOf } from "./secrets.ts";

const ACCESS_HOURS = 8, REFRESH_DAYS = 90, CODE_MINUTES = 10;
export type OAuthClient = { id: string; name: string; redirectUris: string[] };

const isLocal = (u: URL) => ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);

function isAllowedRedirect(text: string): boolean {
  try {
    const u = new URL(text);
    return !u.hash && (u.protocol === "https:" || (u.protocol === "http:" && isLocal(u)));
  } catch { return false; }
}

export async function registerClient(name: unknown, redirectUris: unknown): Promise<OAuthClient> {
  const list = Array.isArray(redirectUris) ? redirectUris.map(String).slice(0, 10) : [];
  if (!list.length || !list.every(isAllowedRedirect)) throw new Error("redirect_uris: at least one is required, https or http://localhost");
  const today = await queryOne<{ n: number }>(`select count(*)::int as n from oauth_clients where created_at > now() - interval '1 day'`);
  if ((today?.n ?? 0) > 300) throw new Error("Too many registrations today. Try again tomorrow.");
  // Cleanup: apps registered more than a month ago that never connected.
  await query(`delete from oauth_clients c where c.created_at < now() - interval '30 days' and not exists (select 1 from tokens t where t.client_id = c.id)`);
  const id = `c_${randomBytes(16).toString("hex")}`;
  const n = String(name || "Unnamed app").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 80) || "Unnamed app";
  await query(`insert into oauth_clients (id, name, redirect_uris) values ($1, $2, array(select jsonb_array_elements_text($3::jsonb)))`, [id, n, list]);
  return { id, name: n, redirectUris: list };
}

export async function clientById(id: string): Promise<OAuthClient | null> {
  return queryOne<OAuthClient>(`select id, name, redirect_uris as "redirectUris" from oauth_clients where id = $1`, [id]);
}

/** The redirect must be one of the registered ones. On localhost the port may change (RFC 8252). */
export function isValidRedirect(c: OAuthClient, uri: string): boolean {
  if (c.redirectUris.includes(uri)) return true;
  try {
    const u = new URL(uri);
    if (!isLocal(u) || u.protocol !== "http:") return false;
    return c.redirectUris.some((r) => { const x = new URL(r); return x.protocol === "http:" && isLocal(x) && x.pathname === u.pathname; });
  } catch { return false; }
}

export async function createCode(d: { clientId: string; personId: string; redirectUri: string; challenge: string }): Promise<string> {
  const code = newSecret("code");
  await query(`delete from oauth_codes where expires_at < now()`);
  await query(`insert into oauth_codes (fingerprint, client_id, person_id, redirect_uri, challenge, expires_at) values ($1, $2, $3, $4, $5, now() + make_interval(mins => $6::int))`,
    [fingerprint(code), d.clientId, d.personId, d.redirectUri, d.challenge, CODE_MINUTES]);
  return code;
}

export type TokenSet = { access_token: string; token_type: "Bearer"; expires_in: number; refresh_token: string; scope: "hub" };

async function issueTokens(personId: string, clientId: string): Promise<TokenSet> {
  const active = await queryOne(`select 1 from people where id = $1 and active`, [personId]);
  if (!active) throw new Error("This person no longer has access to the hub");
  const client = await clientById(clientId);
  const access = newSecret("hub"), refresh = newSecret("ref");
  await query(
    `insert into tokens (person_id, kind, name, prefix, fingerprint, client_id, expires_at) values
       ($1, 'access', $2, $3, $4, $5, now() + make_interval(hours => $6::int)),
       ($1, 'refresh', $2, $7, $8, $5, now() + make_interval(days => $9::int))`,
    [personId, client?.name || "Connected AI", prefixOf(access), fingerprint(access), clientId, ACCESS_HOURS, prefixOf(refresh), fingerprint(refresh), REFRESH_DAYS]);
  await query(`delete from tokens where kind in ('access', 'refresh') and (expires_at < now() - interval '1 day' or revoked_at < now() - interval '1 day')`);
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_HOURS * 3600, refresh_token: refresh, scope: "hub" };
}

/** Exchanges a code for tokens. The code works once; client, redirect and PKCE are checked. */
export async function exchangeCode(d: { code: string; clientId: string; redirectUri: string; verifier: string }): Promise<TokenSet> {
  const row = (await query<{ client_id: string; person_id: string; redirect_uri: string; challenge: string; still_valid: boolean }>(
    `delete from oauth_codes where fingerprint = $1 returning client_id, person_id, redirect_uri, challenge, expires_at > now() as still_valid`, [fingerprint(d.code)]))[0];
  const computed = createHash("sha256").update(d.verifier).digest("base64url");
  if (!row || !row.still_valid || row.client_id !== d.clientId || row.redirect_uri !== d.redirectUri || row.challenge !== computed) throw new Error("Invalid or expired code");
  return issueTokens(row.person_id, row.client_id);
}

/** Exchanges a refresh token for a new pair. The old one stops working (rotation). */
export async function refreshTokens(refreshToken: string, clientId: string): Promise<TokenSet> {
  const row = (await query<{ person_id: string }>(
    `update tokens set revoked_at = now() where fingerprint = $1 and kind = 'refresh' and client_id = $2 and revoked_at is null and expires_at > now() returning person_id`,
    [fingerprint(refreshToken), clientId]))[0];
  if (!row) throw new Error("Invalid refresh token");
  return issueTokens(row.person_id, clientId);
}
