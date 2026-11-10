"use server";
// Actions for the core pages. Each one starts with requireAccess() and its permission, and anything that changes
// something shared is written to the log. The ones that return a secret do it once, to components/secret-form.tsx.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hub } from "@/hub.config.ts";
import { requireAccess } from "@/lib/session.ts";
import { writeLog } from "@/lib/log.ts";
import { isPermission } from "@/lib/permissions.ts";
import * as P from "@/lib/people.ts";
import * as C from "@/lib/connectors.ts";
import * as D from "@/lib/devices.ts";
import { hubUrl } from "@/lib/url.ts";
import type { SecretResult } from "@/components/secret-form.tsx";

const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const messageOf = (e: unknown) => (e instanceof Error ? e.message : "Could not do it");

/** Runs the action and goes back to the page with ?ok=… or ?error=… */
async function run(path: string, okText: string, fn: () => Promise<void>): Promise<never> {
  let error = "";
  try { await fn(); } catch (e) { error = messageOf(e); }
  revalidatePath(path);
  redirect(`${path}?${error ? `error=${encodeURIComponent(error)}` : `ok=${encodeURIComponent(okText)}`}`);
}

// ── Log ──────────────────────────────────────────────────────
export async function addLogEntry(f: FormData) {
  const person = await requireAccess("log:write");
  const returnTo = t(f, "returnTo") === "/" ? "/" : "/log";
  await run(returnTo, "Added to the log.", async () => {
    const kind = t(f, "kind"), title = t(f, "title");
    if (!["decision", "change", "project", "note"].includes(kind)) throw new Error("Choose the kind");
    if (title.length < 3) throw new Error("The title is missing");
    const area = hub.areas.find((a) => a === t(f, "area")) ?? "";
    await writeLog({ person, via: "web", kind: kind as "note", area, title, detail: t(f, "detail") });
  });
}

// ── Team ─────────────────────────────────────────────────────
export async function addPerson(_previous: SecretResult, f: FormData): Promise<SecretResult> {
  const person = await requireAccess("team:manage");
  try {
    const email = t(f, "email"), role = t(f, "role");
    const id = await P.createPerson({ email, name: t(f, "name"), role });
    await writeLog({ person, via: "web", kind: "change", area: "Hub", title: `Added ${P.normalizeEmail(email)}`, detail: `Role: ${role}` });
    revalidatePath("/team");
    return { ok: true, secret: `${hubUrl()}/invite/${await P.createInvite(id)}`, title: "Send them this link so they can set their password. It is valid for 7 days and works once.", note: "If they sign in with Google, they do not need it." };
  } catch (e) { return { error: messageOf(e) }; }
}

export async function passwordLink(_previous: SecretResult, f: FormData): Promise<SecretResult> {
  const person = await requireAccess("team:manage");
  try {
    const id = t(f, "id");
    const code = await P.createInvite(id);
    await writeLog({ person, via: "web", kind: "usage", area: "Hub", title: "Password link created", data: { person: id } });
    return { ok: true, secret: `${hubUrl()}/invite/${code}`, title: "Link to set a new password. It is valid for 7 days and works once." };
  } catch (e) { return { error: messageOf(e) }; }
}

export async function updatePerson(f: FormData) {
  const person = await requireAccess("team:manage");
  await run("/team", "Saved.", async () => {
    const id = t(f, "id"), role = t(f, "role"), active = t(f, "active");
    await P.updatePerson(id, { role: role || undefined, active: active ? active === "yes" : undefined });
    await writeLog({ person, via: "web", kind: "change", area: "Hub", title: "Team member changed", detail: [role && `role: ${role}`, active && `active: ${active}`].filter(Boolean).join(", "), data: { person: id } });
  });
}

export async function saveRole(f: FormData) {
  const person = await requireAccess("team:manage");
  await run("/team", "Role saved.", async () => {
    const slug = t(f, "slug").toLowerCase(), name = t(f, "name");
    if (!/^[a-z][a-z0-9_-]{1,39}$/.test(slug)) throw new Error('The role ID is lowercase with no spaces: for example "sales"');
    if (!name) throw new Error("The role name is missing");
    const permissions = [...f.getAll("permission").map(String), ...t(f, "other").split(/[\s,]+/)].map((p) => p.trim()).filter(Boolean);
    const invalid = permissions.filter((p) => !isPermission(p));
    if (invalid.length) throw new Error(`Misspelled permissions: ${invalid.join(", ")}`);
    if (permissions.includes("*")) throw new Error('The "*" permission belongs to the admin role only');
    await P.saveRole({ slug, name, description: t(f, "description"), permissions });
    await writeLog({ person, via: "web", kind: "change", area: "Hub", title: `Role "${name}" saved`, detail: permissions.join(", ") });
  });
}

export async function deleteRole(f: FormData) {
  const person = await requireAccess("team:manage");
  await run("/team", "Role deleted.", async () => {
    await P.deleteRole(t(f, "slug"));
    await writeLog({ person, via: "web", kind: "change", area: "Hub", title: `Role "${t(f, "slug")}" deleted` });
  });
}

// ── Connectors ───────────────────────────────────────────────
export async function saveConnector(f: FormData) {
  const person = await requireAccess("connectors:manage");
  await run("/connectors", "Connector saved.", async () => {
    const slug = t(f, "slug").toLowerCase();
    await C.saveConnector({
      slug, name: t(f, "name"), description: t(f, "description"), base_url: t(f, "base_url"),
      auth_type: t(f, "auth_type"), auth_name: t(f, "auth_name"), secret: t(f, "secret"), active: f.get("active") === "on",
    }, person.name);
    await writeLog({ person, via: "web", kind: "change", area: "Hub", title: `Connector "${slug}" saved`, detail: t(f, "secret") ? "With a new secret" : "" });
  });
}

export async function deleteConnector(f: FormData) {
  const person = await requireAccess("connectors:manage");
  await run("/connectors", "Connector deleted.", async () => {
    await C.deleteConnector(t(f, "slug"));
    await writeLog({ person, via: "web", kind: "change", area: "Hub", title: `Connector "${t(f, "slug")}" deleted` });
  });
}

// ── Devices ──────────────────────────────────────────────────
const agentCommand = (key: string) => `HUB_URL=${hubUrl()} HUB_DEVICE_KEY=${key} node devices/agent.mjs`;

export async function addDevice(_previous: SecretResult, f: FormData): Promise<SecretResult> {
  const person = await requireAccess("devices:manage");
  try {
    const slug = t(f, "slug").toLowerCase();
    const key = await D.createDevice({ slug, name: t(f, "name"), kind: t(f, "kind"), location: t(f, "location") });
    await writeLog({ person, via: "web", kind: "change", area: "Hub", title: `Device "${slug}" added` });
    revalidatePath("/devices");
    return { ok: true, secret: key, title: "Device key. Copy it now: it will not be shown again.", command: agentCommand(key) };
  } catch (e) { return { error: messageOf(e) }; }
}

export async function rotateDeviceKey(_previous: SecretResult, f: FormData): Promise<SecretResult> {
  const person = await requireAccess("devices:manage");
  try {
    const key = await D.rotateDeviceKey(t(f, "slug"));
    await writeLog({ person, via: "web", kind: "change", area: "Hub", title: `New key for the device "${t(f, "slug")}"` });
    return { ok: true, secret: key, title: "New key. The old one no longer works.", command: agentCommand(key) };
  } catch (e) { return { error: messageOf(e) }; }
}

export async function updateDevice(f: FormData) {
  const person = await requireAccess("devices:manage");
  const slug = t(f, "slug"), op = t(f, "op");
  await run("/devices", op === "test" ? "Test job added to the queue." : "Done.", async () => {
    if (op === "delete") await D.deleteDevice(slug);
    else if (op === "activate" || op === "deactivate") await D.updateDevice(slug, { active: op === "activate" });
    else if (op === "test") await D.enqueueJob(slug, "test", { text: `Test from the hub, requested by ${person.name}` }, person.name);
    else throw new Error("Unknown action");
    if (op !== "test") await writeLog({ person, via: "web", kind: "change", area: "Hub", title: `Device "${slug}": ${op}` });
  });
}

// ── My AI ────────────────────────────────────────────────────
export async function createToken(_previous: SecretResult, f: FormData): Promise<SecretResult> {
  const person = await requireAccess();
  try {
    const token = await P.createToken(person.id, t(f, "name") || "My AI");
    await writeLog({ person, via: "web", kind: "usage", area: "Hub", title: "Token created to connect an AI" });
    revalidatePath("/my-ai");
    return { ok: true, secret: token, title: "Your token. Copy it now: it will not be shown again.", command: `claude mcp add --transport http hub ${hubUrl()}/api/mcp --header "Authorization: Bearer ${token}"`, note: "Anyone who has this token acts in your name." };
  } catch (e) { return { error: messageOf(e) }; }
}

export async function revokeToken(f: FormData) {
  const person = await requireAccess();
  await run("/my-ai", "AI disconnected.", async () => {
    await P.revokeToken(person.id, t(f, "id"));
    await writeLog({ person, via: "web", kind: "usage", area: "Hub", title: "AI connection closed" });
  });
}
