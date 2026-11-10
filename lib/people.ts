// People, roles, invites, sessions and tokens. This file only talks to the database; cookies are in lib/session.ts.
import { query, json, queryOne } from "./db.ts";
import { MIN_PASSWORD_LENGTH, verifyPassword, hashPassword, fingerprint, newSecret, prefixOf } from "./secrets.ts";

export type Person = { id: string; email: string; name: string; role: string; roleName: string; permissions: string[] };
export type PersonRow = { id: string; email: string; name: string; role: string; active: boolean; has_password: boolean; last_sign_in_at: Date | null };
export type Role = { slug: string; name: string; description: string; permissions: string[]; is_system: boolean; people: number };

const PERSON = `select p.id, p.email, p.name, p.role, r.name as "roleName", r.permissions
                  from people p join roles r on r.slug = p.role`;
export const normalizeEmail = (e: unknown) => String(e ?? "").trim().toLowerCase();
const SESSION_DAYS = 30, INVITE_DAYS = 7, MAX_FAILURES = 8, LOCK_MINUTES = 15;

// ── Sign-in ──────────────────────────────────────────────────
export type SignInResult = { ok: true; person: Person } | { ok: false; reason: "credentials" | "locked" };

/** Checks email and password. After 8 failures in 15 minutes with the same email, the person has to wait. */
export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  const e = normalizeEmail(email);
  const failures = await queryOne<{ n: number }>(
    `select count(*)::int as n from failed_sign_ins where email = $1 and created_at > now() - make_interval(mins => $2::int)`, [e, LOCK_MINUTES]);
  if ((failures?.n ?? 0) >= MAX_FAILURES) return { ok: false, reason: "locked" };
  const row = await queryOne<Person & { password_hash: string | null }>(
    `select p.id, p.email, p.name, p.role, r.name as "roleName", r.permissions, p.password_hash
       from people p join roles r on r.slug = p.role where p.email = $1 and p.active`, [e]);
  // The hash is always computed, whether the person exists or not, so the response takes the same time.
  const matches = await verifyPassword(password, row?.password_hash ?? `scrypt$16384$8$1$${"A".repeat(22)}$${"A".repeat(86)}`);
  if (!row || !matches) {
    await query(`insert into failed_sign_ins (email) values ($1)`, [e.slice(0, 200)]);
    return { ok: false, reason: "credentials" };
  }
  await query(`delete from failed_sign_ins where email = $1 or created_at < now() - interval '1 day'`, [e]);
  return { ok: true, person: withoutHash(row) };
}

function withoutHash<T extends Person>(r: T): Person {
  return { id: r.id, email: r.email, name: r.name, role: r.role, roleName: r.roleName, permissions: r.permissions };
}

export async function personByEmail(email: string): Promise<Person | null> {
  return queryOne<Person>(`${PERSON} where p.email = $1 and p.active`, [normalizeEmail(email)]);
}

// ── Sessions ─────────────────────────────────────────────────
/** Opens a session and returns the cookie value (the database keeps only its fingerprint). */
export async function createSession(personId: string): Promise<{ value: string; expires: Date }> {
  const value = newSecret("s");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await query(`insert into sessions (person_id, fingerprint, expires_at) values ($1, $2, $3)`, [personId, fingerprint(value), expires.toISOString()]);
  await query(`update people set last_sign_in_at = now() where id = $1`, [personId]);
  await query(`delete from sessions where expires_at < now()`);
  return { value, expires };
}

export async function personFromSession(value: string | undefined): Promise<Person | null> {
  if (!value) return null;
  return queryOne<Person>(`${PERSON} join sessions s on s.person_id = p.id where s.fingerprint = $1 and s.expires_at > now() and p.active`, [fingerprint(value)]);
}

export async function deleteSession(value: string | undefined) {
  if (value) await query(`delete from sessions where fingerprint = $1`, [fingerprint(value)]);
}

// ── People and roles ─────────────────────────────────────────
export async function listPeople(): Promise<PersonRow[]> {
  return query<PersonRow>(
    `select id, email, name, role, active, password_hash is not null as has_password, last_sign_in_at from people order by active desc, name, email`);
}

export async function createPerson(d: { email: string; name: string; role: string }): Promise<string> {
  const email = normalizeEmail(d.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("The email is not valid");
  if (await queryOne(`select 1 from people where email = $1`, [email])) throw new Error("There is already a person with that email");
  const rows = await query<{ id: string }>(`insert into people (email, name, role) values ($1, $2, $3) returning id`,
    [email, String(d.name || "").trim().slice(0, 120) || email.split("@")[0], d.role]);
  return rows[0].id;
}

/** Changes role or status. Never leaves the hub without an active person who can manage the team. */
export async function updatePerson(id: string, d: { role?: string; active?: boolean; name?: string }) {
  const before = await queryOne<{ role: string; active: boolean }>(`select role, active from people where id = $1`, [id]);
  if (!before) throw new Error("That person does not exist");
  await query(`update people set role = coalesce($2, role), active = coalesce($3, active), name = coalesce($4, name) where id = $1`,
    [id, d.role ?? null, d.active ?? null, d.name?.trim().slice(0, 120) || null]);
  const remaining = await queryOne<{ n: number }>(
    `select count(*)::int as n from people p join roles r on r.slug = p.role
      where p.active and (r.permissions @> array['*'] or r.permissions @> array['team:manage'])`);
  if (!remaining?.n) {
    await query(`update people set role = $2, active = $3 where id = $1`, [id, before.role, before.active]);
    throw new Error("There must be at least one active person who can manage the team");
  }
  if (d.active === false) {
    await query(`delete from sessions where person_id = $1`, [id]);
    await query(`update tokens set revoked_at = now() where person_id = $1 and revoked_at is null`, [id]);
  }
}

export async function listRoles(): Promise<Role[]> {
  return query<Role>(
    `select r.slug, r.name, r.description, r.permissions, r.is_system, (select count(*)::int from people p where p.role = r.slug) as people
       from roles r order by r.is_system desc, r.name`);
}

export async function saveRole(d: { slug: string; name: string; description?: string; permissions: string[] }) {
  const existing = await queryOne<{ is_system: boolean }>(`select is_system from roles where slug = $1`, [d.slug]);
  if (existing?.is_system) throw new Error("The admin role cannot be changed");
  await query(
    `insert into roles (slug, name, description, permissions) values ($1, $2, $3, array(select jsonb_array_elements_text($4::jsonb)))
     on conflict (slug) do update set name = excluded.name, description = excluded.description, permissions = excluded.permissions`,
    [d.slug, d.name.trim().slice(0, 60), String(d.description || "").trim().slice(0, 300), json([...new Set(d.permissions)])]);
}

export async function deleteRole(slug: string) {
  const r = await queryOne<{ is_system: boolean; n: number }>(
    `select is_system, (select count(*)::int from people where role = $1) as n from roles where slug = $1`, [slug]);
  if (!r) return;
  if (r.is_system) throw new Error("The admin role cannot be deleted");
  if (r.n) throw new Error("There are people with this role: move them to another role before deleting it");
  await query(`delete from roles where slug = $1`, [slug]);
}

// ── Invites (link to set the password) ───────────────────────
/** Creates a single-use link, valid for 7 days. Returns the code that goes in /invite/<code>. */
export async function createInvite(personId: string): Promise<string> {
  const code = newSecret("inv");
  await query(`delete from invites where person_id = $1 and used_at is null`, [personId]);
  await query(`insert into invites (person_id, fingerprint, expires_at) values ($1, $2, now() + make_interval(days => $3::int))`,
    [personId, fingerprint(code), INVITE_DAYS]);
  return code;
}

export async function personFromInvite(code: string): Promise<{ id: string; email: string; name: string } | null> {
  return queryOne(`select p.id, p.email, p.name from invites i join people p on p.id = i.person_id
                    where i.fingerprint = $1 and i.used_at is null and i.expires_at > now() and p.active`, [fingerprint(code)]);
}

/** Sets the password with a valid invite and uses it up. Closes any open sessions. */
export async function redeemInvite(code: string, password: string): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`The password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  const hash = await hashPassword(password);
  const rows = await query<{ person_id: string }>(
    `update invites set used_at = now() where fingerprint = $1 and used_at is null and expires_at > now() returning person_id`, [fingerprint(code)]);
  if (!rows.length) throw new Error("The link has already been used or has expired. Ask for a new one.");
  await query(`update people set password_hash = $2 where id = $1`, [rows[0].person_id, hash]);
  await query(`delete from sessions where person_id = $1`, [rows[0].person_id]);
  return rows[0].person_id;
}

// ── Personal tokens (to connect an AI) ───────────────────────
export type TokenRow = { id: string; kind: string; name: string; prefix: string; created_at: Date; last_used_at: Date | null; expires_at: Date | null };

export async function createToken(personId: string, name: string): Promise<string> {
  const token = newSecret("hub");
  await query(`insert into tokens (person_id, kind, name, prefix, fingerprint) values ($1, 'personal', $2, $3, $4)`,
    [personId, name.trim().slice(0, 80) || "My AI", prefixOf(token), fingerprint(token)]);
  return token;
}

export async function listTokens(personId: string): Promise<TokenRow[]> {
  // For an OAuth connection the refresh token is the one shown; its last use is that of its access tokens.
  return query<TokenRow>(
    `select t.id, t.kind, t.name, t.prefix, t.created_at, t.expires_at,
            case when t.client_id is null then t.last_used_at
                 else (select max(a.last_used_at) from tokens a where a.person_id = t.person_id and a.client_id = t.client_id) end as last_used_at
       from tokens t
      where t.person_id = $1 and t.revoked_at is null and t.kind in ('personal', 'refresh') and (t.expires_at is null or t.expires_at > now())
      order by t.created_at desc`, [personId]);
}

export async function revokeToken(personId: string, id: string) {
  // Revoking an OAuth connection also removes the access tokens of that same app.
  await query(
    `update tokens set revoked_at = now() where person_id = $1 and revoked_at is null
        and (id = $2::uuid or (client_id is not null and client_id = (select client_id from tokens where id = $2::uuid and person_id = $1)))`,
    [personId, id]);
}

/** The person who owns a valid "personal" or "access" token. Records the last use at most once per minute. */
export async function personFromToken(token: string | null | undefined): Promise<Person | null> {
  if (!token || token.length < 20) return null;
  const row = await queryOne<Person & { token_id: string; last_used: Date | null }>(
    `select p.id, p.email, p.name, p.role, r.name as "roleName", r.permissions, t.id as token_id, t.last_used_at as last_used
       from tokens t join people p on p.id = t.person_id join roles r on r.slug = p.role
      where t.fingerprint = $1 and t.kind in ('personal', 'access') and t.revoked_at is null
        and (t.expires_at is null or t.expires_at > now()) and p.active`, [fingerprint(token)]);
  if (!row) return null;
  if (!row.last_used || Date.now() - new Date(row.last_used).getTime() > 60000) await query(`update tokens set last_used_at = now() where id = $1`, [row.token_id]);
  return withoutHash(row);
}
