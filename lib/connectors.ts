// Connectors: outside services the hub calls on behalf of a person. The secret is stored encrypted
// and is only decrypted here, at the moment of the call. No screen and no tool returns it.
import { query, queryOne } from "./db.ts";
import { encrypt, decrypt } from "./crypto.ts";

export const AUTH_TYPES = ["none", "bearer", "header", "query", "basic"] as const;
export type AuthType = (typeof AUTH_TYPES)[number];
export type Connector = {
  id: string; slug: string; name: string; description: string; base_url: string; auth_type: AuthType; auth_name: string;
  secret_hint: string; has_secret: boolean; active: boolean; updated_at: Date; updated_by: string;
};

const COLUMNS = `id, slug, name, description, base_url, auth_type, auth_name, secret_hint,
                 secret_encrypted is not null as has_secret, active, updated_at, updated_by`;

export async function listConnectors(): Promise<Connector[]> {
  return query<Connector>(`select ${COLUMNS} from connectors order by name`);
}

export async function connectorBySlug(slug: string): Promise<Connector | null> {
  return queryOne<Connector>(`select ${COLUMNS} from connectors where slug = $1`, [slug]);
}

export type ConnectorInput = {
  slug: string; name: string; description?: string; base_url?: string; auth_type?: string; auth_name?: string;
  secret?: string; active?: boolean;
};

/** Creates or changes a connector. If `secret` is empty, the stored one is kept. */
export async function saveConnector(d: ConnectorInput, by: string) {
  if (!/^[a-z][a-z0-9_-]{1,39}$/.test(d.slug)) throw new Error('The identifier is lowercase, with no spaces: for example "crm" or "accounting"');
  const auth = (AUTH_TYPES as readonly string[]).includes(d.auth_type || "") ? d.auth_type! : "none";
  const url = String(d.base_url || "").trim().replace(/\/+$/, "");
  if (url) checkBaseUrl(url);
  if ((auth === "header" || auth === "query") && !d.auth_name?.trim()) throw new Error("The name of the header or parameter that carries the secret is missing");
  const secret = String(d.secret || "").trim();
  await query(
    `insert into connectors (slug, name, description, base_url, auth_type, auth_name, secret_encrypted, secret_hint, active, updated_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (slug) do update set name = excluded.name, description = excluded.description, base_url = excluded.base_url,
       auth_type = excluded.auth_type, auth_name = excluded.auth_name, active = excluded.active,
       secret_encrypted = coalesce(excluded.secret_encrypted, connectors.secret_encrypted),
       secret_hint = case when excluded.secret_encrypted is null then connectors.secret_hint else excluded.secret_hint end,
       updated_at = now(), updated_by = excluded.updated_by`,
    [d.slug, d.name.trim().slice(0, 80) || d.slug, String(d.description || "").trim().slice(0, 600), url, auth, String(d.auth_name || "").trim().slice(0, 80),
     secret ? encrypt(secret) : null, secret ? secret.slice(-4) : "", d.active ?? true, by]);
}

export async function deleteConnector(slug: string) {
  await query(`delete from connectors where slug = $1`, [slug]);
}

function checkBaseUrl(url: string): URL {
  let u: URL;
  try { u = new URL(url); } catch { throw new Error("The base URL is not a valid URL"); }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local && process.env.NODE_ENV !== "production")) throw new Error("The base URL must start with https://");
  if (u.username || u.password || u.search || u.hash) throw new Error('The base URL cannot contain a user, parameters or "#"');
  return u;
}

export type ConnectorRequest = {
  method?: string; path: string; query?: Record<string, string | number | boolean>;
  body?: unknown; headers?: Record<string, string>;
};
export type ConnectorResponse = { status: number; contentType: string; body: string; truncated: boolean; redirect?: string };

export const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const MAX_RESPONSE = 60000;
const FORBIDDEN_HEADERS = /^(authorization|cookie|host|proxy-authorization|content-length|connection|transfer-encoding)$/i;

/**
 * Calls the connector's service with its secret added by the server. The address cannot leave the connector's
 * base URL, redirects are not followed, and if the service returns the secret in the response it is masked.
 */
export async function callConnector(slug: string, p: ConnectorRequest): Promise<ConnectorResponse> {
  const c = await queryOne<Connector & { secret_encrypted: string | null }>(`select ${COLUMNS}, secret_encrypted from connectors where slug = $1`, [slug]);
  if (!c || !c.active) throw new Error(`There is no active connector with the identifier "${slug}"`);
  if (!c.base_url) throw new Error(`The connector "${c.name}" has no base URL: it cannot receive requests`);
  const base = checkBaseUrl(c.base_url);
  const method = String(p.method || "GET").toUpperCase();
  if (!(METHODS as readonly string[]).includes(method)) throw new Error(`Method not allowed: ${method}`);
  if (!p.path.startsWith("/") || p.path.startsWith("//")) throw new Error('The path must start with a single "/"');

  const [pathOnly, inPath = ""] = p.path.split("#")[0].split(/\?(.*)/s);
  const url = new URL(base.pathname.replace(/\/+$/, "") + pathOnly, base.origin);
  if (url.origin !== base.origin || !(url.pathname + "/").startsWith(base.pathname.replace(/\/+$/, "") + "/")) throw new Error("The path goes outside the connector's base URL");
  for (const [k, v] of new URLSearchParams(inPath)) url.searchParams.append(k, v);
  for (const [k, v] of Object.entries(p.query || {})) url.searchParams.set(k, String(v));

  const secret = c.secret_encrypted ? decrypt(c.secret_encrypted) : "";
  if (c.auth_type !== "none" && !secret) throw new Error(`The connector "${c.name}" has no secret stored`);
  const headers = new Headers({ accept: "application/json" });
  for (const [k, v] of Object.entries(p.headers || {})) {
    if (FORBIDDEN_HEADERS.test(k) || (c.auth_type === "header" && k.toLowerCase() === c.auth_name.toLowerCase())) continue;
    headers.set(k, String(v));
  }
  if (c.auth_type === "bearer") headers.set("authorization", `Bearer ${secret}`);
  if (c.auth_type === "basic") headers.set("authorization", `Basic ${Buffer.from(secret).toString("base64")}`);
  if (c.auth_type === "header") headers.set(c.auth_name, secret);
  if (c.auth_type === "query") url.searchParams.set(c.auth_name, secret);

  let body: string | undefined;
  if (p.body !== undefined && p.body !== null && method !== "GET") {
    body = typeof p.body === "string" ? p.body : JSON.stringify(p.body);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
  }

  const r = await fetch(url, { method, headers, body, redirect: "manual", signal: AbortSignal.timeout(30000) });
  const mask = (t: string) => {
    if (secret.length < 6) return t;
    let s = t.split(secret).join("[secret]");
    const encoded = encodeURIComponent(secret);
    if (encoded !== secret) s = s.split(encoded).join("[secret]");
    return s;
  };
  const text = mask(await r.text());
  const location = r.headers.get("location");
  return {
    status: r.status, contentType: r.headers.get("content-type") || "",
    body: text.slice(0, MAX_RESPONSE), truncated: text.length > MAX_RESPONSE,
    ...(location ? { redirect: mask(location) } : {}),
  };
}
