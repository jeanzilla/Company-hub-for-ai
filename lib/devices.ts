// Physical devices. The device (or the computer that drives it) calls the hub with its key: it sends heartbeats,
// picks up its jobs, confirms each one and sends events. The hub opens no connections toward the premises.
import { query, json, queryOne } from "./db.ts";
import { fingerprint, newSecret, prefixOf } from "./secrets.ts";

export type Device = {
  id: string; slug: string; name: string; kind: string; location: string; key_prefix: string; active: boolean;
  last_heartbeat_at: Date | null; status: Record<string, unknown>; pending: number;
};
export type Job = {
  id: string; device_id: string; kind: string; payload: Record<string, unknown>; status: string; attempts: number;
  requested_by: string; result: string; created_at: Date; finished_at: Date | null;
};

export const ONLINE_SECONDS = 120;
export const isOnline = (d: { last_heartbeat_at: Date | null }) =>
  !!d.last_heartbeat_at && Date.now() - new Date(d.last_heartbeat_at).getTime() < ONLINE_SECONDS * 1000;

const COLUMNS = `d.id, d.slug, d.name, d.kind, d.location, d.key_prefix, d.active, d.last_heartbeat_at, d.status,
  (select count(*)::int from device_jobs t where t.device_id = d.id and t.status in ('pending', 'delivered')) as pending`;

export async function listDevices(): Promise<Device[]> {
  return query<Device>(`select ${COLUMNS} from devices d order by d.name`);
}

export async function deviceBySlug(slug: string): Promise<Device | null> {
  return queryOne<Device>(`select ${COLUMNS} from devices d where d.slug = $1`, [slug]);
}

/** Registers a device and returns its key. This is the only time the key is visible: the database keeps only the fingerprint. */
export async function createDevice(d: { slug: string; name: string; kind?: string; location?: string }): Promise<string> {
  if (!/^[a-z][a-z0-9_-]{1,39}$/.test(d.slug)) throw new Error('The identifier is lowercase, with no spaces: for example "warehouse-printer"');
  if (await queryOne(`select 1 from devices where slug = $1`, [d.slug])) throw new Error("There is already a device with that identifier");
  const key = newSecret("dev");
  await query(`insert into devices (slug, name, kind, location, key_prefix, key_fingerprint) values ($1, $2, $3, $4, $5, $6)`,
    [d.slug, d.name.trim().slice(0, 80) || d.slug, String(d.kind || "other").trim().slice(0, 40), String(d.location || "").trim().slice(0, 120), prefixOf(key), fingerprint(key)]);
  return key;
}

export async function rotateDeviceKey(slug: string): Promise<string> {
  const key = newSecret("dev");
  const rows = await query(`update devices set key_prefix = $2, key_fingerprint = $3 where slug = $1 returning id`, [slug, prefixOf(key), fingerprint(key)]);
  if (!rows.length) throw new Error("That device does not exist");
  return key;
}

export async function updateDevice(slug: string, d: { active?: boolean }) {
  await query(`update devices set active = coalesce($2, active) where slug = $1`, [slug, d.active ?? null]);
}

export async function deleteDevice(slug: string) {
  await query(`delete from devices where slug = $1`, [slug]);
}

/** The device that owns a key (X-Device-Key header), if it is active. */
export async function deviceFromKey(key: string | null | undefined): Promise<{ id: string; slug: string; name: string } | null> {
  if (!key || key.length < 20) return null;
  return queryOne(`select id, slug, name from devices where key_fingerprint = $1 and active`, [fingerprint(key)]);
}

/** Heartbeat: stores the status the device sends and hands over its pending jobs. */
export async function heartbeat(id: string, status?: Record<string, unknown>): Promise<Job[]> {
  await query(`update devices set last_heartbeat_at = now(), status = coalesce($2::jsonb, status) where id = $1`,
    [id, status && typeof status === "object" ? json(status) : null]);
  return query<Job>(`select * from claim_jobs($1::uuid, 10)`, [id]);
}

/** The device confirms a job. It can only close its own jobs. */
export async function finishJob(deviceId: string, jobId: string, ok: boolean, result = ""): Promise<boolean> {
  const rows = await query(
    `update device_jobs set status = $3, finished_at = now(), result = $4
      where id = $2::uuid and device_id = $1 and status in ('delivered', 'pending') returning id`,
    [deviceId, jobId, ok ? "done" : "error", String(result).slice(0, 1000)]);
  return rows.length > 0;
}

export async function saveEvent(deviceId: string, kind: string, data: unknown): Promise<string> {
  const rows = await query<{ id: string }>(`insert into device_events (device_id, kind, data) values ($1, $2, $3::jsonb) returning id`,
    [deviceId, String(kind).slice(0, 60), json(data && typeof data === "object" ? data : { value: data })]);
  return rows[0].id;
}

/** Puts a job in a device's queue. The device picks it up on its next heartbeat. */
export async function enqueueJob(slug: string, kind: string, payload: Record<string, unknown>, requestedBy: string): Promise<{ id: string; online: boolean }> {
  const d = await deviceBySlug(slug);
  if (!d || !d.active) throw new Error(`There is no active device with the identifier "${slug}"`);
  const rows = await query<{ id: string }>(`insert into device_jobs (device_id, kind, payload, requested_by) values ($1, $2, $3::jsonb, $4) returning id`,
    [d.id, String(kind).slice(0, 60), json(payload), requestedBy.slice(0, 120)]);
  return { id: rows[0].id, online: isOnline(d) };
}

export async function recentJobs(limit = 30): Promise<(Job & { device: string })[]> {
  return query(`select t.*, d.name as device from device_jobs t join devices d on d.id = t.device_id order by t.created_at desc limit $1`, [limit]);
}

export async function recentEvents(limit = 30): Promise<{ id: string; created_at: Date; kind: string; data: Record<string, unknown>; device: string }[]> {
  return query(`select e.id, e.created_at, e.kind, e.data, d.name as device from device_events e join devices d on d.id = e.device_id order by e.created_at desc limit $1`, [limit]);
}
