// The core against a real Postgres (PGlite in memory): migrations, sign-in, permissions, a log that cannot be
// erased, connectors that never leak a secret, the device queue and the MCP from end to end.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomBytes } from "node:crypto";
import { startDb } from "../scripts/lib/local-db.mjs";
import { migrate } from "../scripts/lib/migrations.mjs";

process.env.HUB_ENCRYPTION_KEY = randomBytes(32).toString("base64");
const SECRET = "test-secret-0123456789";
let localDb, echo, echoUrl, db, P, L, C, D, M, proto;
const seen = [];

before(async () => {
  localDb = await startDb();
  process.env.DATABASE_URL = localDb.url;
  assert.ok((await migrate(localDb.url, { quiet: true })).length >= 1);
  assert.equal((await migrate(localDb.url, { quiet: true })).length, 0, "the second time there is nothing to apply");
  // Made-up outside service: it returns what it receives, secret included, to check that the hub masks it.
  echo = http.createServer((req, res) => {
    seen.push({ url: req.url, auth: req.headers.authorization, method: req.method });
    if (req.url.startsWith("/api/jump")) { res.writeHead(302, { location: `http://other.test/?k=${SECRET}` }); return res.end(); }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ path: req.url, authorization: req.headers.authorization, next: `http://x.test/?token=${SECRET}` }));
  });
  await new Promise((ok) => echo.listen(0, "127.0.0.1", ok));
  echoUrl = `http://127.0.0.1:${echo.address().port}/api`;
  db = await import("../lib/db.ts");
  P = await import("../lib/people.ts");
  L = await import("../lib/log.ts");
  C = await import("../lib/connectors.ts");
  D = await import("../lib/devices.ts");
  M = await import("../lib/mcp/server.ts");
  proto = await import("../lib/mcp/protocol.ts");
});
after(async () => { await db?.closeDb(); echo?.close(); await localDb?.stop(); });

let admin, luis;

test("people: creation, single-use invite and sign-in with a password", async () => {
  const adminId = await P.createPerson({ email: "  Ana@Example.test ", name: "Ana", role: "admin" });
  await assert.rejects(P.createPerson({ email: "ana@example.test", name: "Other", role: "member" }), /already/);
  assert.deepEqual(await P.signInWithPassword("ana@example.test", "whatever"), { ok: false, reason: "credentials" });
  const code = await P.createInvite(adminId);
  assert.equal((await P.personFromInvite(code)).email, "ana@example.test");
  await assert.rejects(P.redeemInvite(code, "short"), /at least/);
  await P.redeemInvite(code, "ana long password");
  await assert.rejects(P.redeemInvite(code, "new long password 2"), /already.*used/);
  assert.equal(await P.personFromInvite(code), null);
  const e = await P.signInWithPassword("ANA@example.test", "ana long password");
  assert.ok(e.ok);
  admin = e.person;
  assert.deepEqual(admin.permissions, ["*"]);
  assert.equal(admin.password_hash, undefined, "the hash does not leave the function");
  const stored = await db.queryOne(`select password_hash from people where id = $1`, [adminId]);
  assert.ok(!stored.password_hash.includes("long password"));
});

test("sessions: the cookie value is not in the database, and the session can be closed", async () => {
  const s = await P.createSession(admin.id);
  assert.equal((await P.personFromSession(s.value)).id, admin.id);
  assert.equal(await db.queryOne(`select 1 from sessions where fingerprint = $1`, [s.value]), null);
  await P.deleteSession(s.value);
  assert.equal(await P.personFromSession(s.value), null);
  assert.equal(await P.personFromSession("s_invented"), null);
});

test("sign-in: 8 failures in a row lock that email for a while", async () => {
  for (let i = 0; i < 8; i++) assert.equal((await P.signInWithPassword("nobody@example.test", "x")).reason, "credentials");
  assert.equal((await P.signInWithPassword("nobody@example.test", "x")).reason, "locked");
});

test("roles: they are created with their permissions, and the last admin cannot be removed", async () => {
  await P.saveRole({ slug: "warehouse", name: "Warehouse", permissions: ["log:read", "log:write", "connector:crm:read", "device:printer:use"] });
  await assert.rejects(P.saveRole({ slug: "admin", name: "X", permissions: [] }), /cannot be changed/);
  const id = await P.createPerson({ email: "luis@example.test", name: "Luis", role: "warehouse" });
  luis = await P.personByEmail("luis@example.test");
  assert.equal(luis.id, id);
  assert.deepEqual(luis.permissions, ["log:read", "log:write", "connector:crm:read", "device:printer:use"]);
  await assert.rejects(P.updatePerson(admin.id, { role: "warehouse" }), /at least one/i);
  await assert.rejects(P.updatePerson(admin.id, { active: false }), /at least one/i);
  assert.equal((await P.personByEmail("ana@example.test")).role, "admin");
  await assert.rejects(P.deleteRole("warehouse"), /this role/);
});

test("log: it is written and cannot be changed, deleted or truncated", async () => {
  await L.writeLog({ person: admin, via: "web", kind: "decision", area: "Hub", title: "Only Ana changes prices", detail: "Agreed on Monday" });
  const [e] = await L.searchLog({ text: "prices" });
  assert.equal(e.who, "Ana");
  assert.equal(e.kind, "decision");
  await assert.rejects(db.query(`update log set title = 'other'`), /cannot be changed/);
  await assert.rejects(db.query(`delete from log`), /cannot be changed/);
  await assert.rejects(db.query(`truncate log`), /cannot be changed/);
  assert.equal((await L.searchLog({ kind: "decision" })).length, 1);
  assert.equal((await L.searchLog({ text: "100%" })).length, 0, "wildcards in the search box are taken as plain text");
});

test("connectors: the secret is stored encrypted, the hub adds it and it never comes back in the response", async () => {
  await C.saveConnector({ slug: "crm", name: "CRM", base_url: echoUrl, auth_type: "bearer", secret: SECRET }, "Ana");
  const row = await db.queryOne(`select secret_encrypted, secret_hint from connectors where slug = 'crm'`);
  assert.ok(row.secret_encrypted.startsWith("v1.") && !row.secret_encrypted.includes(SECRET));
  assert.equal(row.secret_hint, SECRET.slice(-4));
  const list = await C.listConnectors();
  assert.ok(list[0].has_secret && !JSON.stringify(list).includes(SECRET) && !("secret_encrypted" in list[0]));

  const r = await C.callConnector("crm", { path: "/contacts?page=2", query: { q: "ana" }, headers: { authorization: "Bearer intruder", "x-extra": "1" } });
  assert.equal(r.status, 200);
  assert.equal(seen.at(-1).auth, `Bearer ${SECRET}`, "the service receives the real secret, never the one the caller sends");
  assert.equal(seen.at(-1).url, "/api/contacts?page=2&q=ana");
  assert.ok(!r.body.includes(SECRET) && r.body.includes("[secret]"), "if the service returns the secret, it is masked");

  const jump = await C.callConnector("crm", { path: "/jump" });
  assert.equal(jump.status, 302);
  assert.ok(!jump.redirect.includes(SECRET), "nor in a redirect, which is not followed either");

  await assert.rejects(C.callConnector("crm", { path: "/../elsewhere" }), /outside/);
  await assert.rejects(C.callConnector("crm", { path: "//other.test/x" }), /start with/);
  await assert.rejects(C.callConnector("crm", { path: "http://other.test/x" }), /start with/);
  await assert.rejects(C.callConnector("nothing", { path: "/x" }), /no active connector/i);
  await assert.rejects(C.saveConnector({ slug: "bad", name: "Bad", base_url: "http://unencrypted.test" }, "Ana"), /https/);

  await C.saveConnector({ slug: "crm", name: "Sales CRM", base_url: echoUrl, auth_type: "bearer", secret: "" }, "Ana");
  assert.equal((await C.callConnector("crm", { path: "/x" })).status, 200, "saving without a secret keeps the one already stored");
});

test("devices: key shown only once, queue without duplicates and confirmation", async () => {
  const key = await D.createDevice({ slug: "printer", name: "Warehouse printer", kind: "printer" });
  assert.match(key, /^dev_/);
  assert.equal(await db.queryOne(`select 1 from devices where key_fingerprint = $1`, [key]), null);
  const device = await D.deviceFromKey(key);
  assert.equal(device.slug, "printer");
  assert.equal(await D.deviceFromKey("dev_invented_0123456789"), null);

  const j1 = await D.enqueueJob("printer", "print", { text: "Label 1" }, "Luis");
  await D.enqueueJob("printer", "print", { text: "Label 2" }, "Luis");
  assert.equal(j1.online, false, "it has not sent a heartbeat yet");
  const [a, b] = await Promise.all([D.heartbeat(device.id, { paper: "ok" }), D.heartbeat(device.id)]);
  assert.equal(a.length + b.length, 2, "two heartbeats at the same time share the jobs without repeating any");
  assert.equal((await D.heartbeat(device.id)).length, 0);
  const one = [...a, ...b][0];
  assert.deepEqual(Object.keys(one.payload), ["text"]);
  assert.ok(await D.finishJob(device.id, one.id, true, "printed"));
  assert.ok(!(await D.finishJob(device.id, one.id, true)), "a closed job is not closed twice");
  const d = await D.deviceBySlug("printer");
  assert.ok(D.isOnline(d));
  assert.equal(d.status.paper, "ok");
  assert.equal(d.pending, 1);

  await db.query(`update device_jobs set delivered_at = now() - interval '6 minutes' where status = 'delivered'`);
  assert.equal((await D.heartbeat(device.id)).length, 1, "a job delivered and not confirmed within 5 minutes is delivered again");
  await D.saveEvent(device.id, "scan", { card: "A1" });
  assert.equal((await D.recentEvents())[0].data.card, "A1");
  await D.updateDevice("printer", { active: false });
  assert.equal(await D.deviceFromKey(key), null, "a deactivated device can no longer get in");
  await D.updateDevice("printer", { active: true });
});

const callTool = (person, name, args = {}) => proto.handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, M.serverFor(person));
const textOf = (r) => r.result.content[0].text;

test("MCP: each person sees only the tools of their role", async () => {
  const names = (p) => M.toolsFor(p.permissions).map((t) => t.name);
  assert.deepEqual(names(admin).slice(0, 7), ["hub_whoami", "log_search", "log_add", "connectors_list", "connector_request", "devices_list", "device_enqueue"]);
  assert.deepEqual(names({ permissions: ["log:read"] }), ["hub_whoami", "log_search"]);
  assert.deepEqual(names({ permissions: [] }), ["hub_whoami"]);
  const list = await proto.handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" }, M.serverFor(luis));
  assert.ok(list.result.tools.every((t) => t.inputSchema.type === "object" && t.description.length > 20));
});

test("MCP: the permission is checked on every call and everything lands in the log", async () => {
  const read = await callTool(luis, "connector_request", { connector: "crm", path: "/contacts" });
  assert.ok(!read.result.isError && !textOf(read).includes(SECRET));
  const write = await callTool(luis, "connector_request", { connector: "crm", method: "POST", path: "/contacts", body: { name: "X" } });
  assert.ok(write.result.isError && /does not have permission/.test(textOf(write)), "Luis can only read the CRM");
  assert.notEqual(seen.at(-1).method, "POST", "the request without permission does not reach the service");
  const other = await callTool(luis, "connector_request", { connector: "bank", path: "/balance" });
  assert.ok(other.result.isError);
  const unseen = await callTool({ ...luis, permissions: ["log:read"] }, "connector_request", { connector: "crm", path: "/x" });
  assert.equal(unseen.error.code, -32602, "a tool he cannot see does not exist for him");

  assert.deepEqual(JSON.parse(textOf(await callTool(luis, "connectors_list")))[0], { connector: "crm", name: "Sales CRM", description: "", base_url: echoUrl, can_write: false });
  const queue = JSON.parse(textOf(await callTool(luis, "device_enqueue", { device: "printer", kind: "print", payload: { text: "Hello" } })));
  assert.ok(queue.queued && queue.device_online);
  assert.match(textOf(await callTool(luis, "log_add", { kind: "change", area: "sales", title: "New labels in the warehouse" })), /Added to the log/);
  assert.ok((await callTool(luis, "log_add", { kind: "change", area: "Invented", title: "Not valid" })).result.isError);
  assert.match(textOf(await callTool(luis, "log_search", { text: "prices" })), /Only Ana changes prices/);

  const uses = await L.searchLog({ kind: "usage", person: luis.id });
  assert.deepEqual(uses.map((u) => [u.tool, u.ok]), [["log_add", false], ["device_enqueue", true], ["connector_request", false], ["connector_request", false], ["connector_request", true]],
    "failures are always logged, including those of the tools that skip the log when they succeed");
  assert.ok(uses.every((u) => u.via === "mcp" && u.who === "Luis" && !JSON.stringify(u.data).includes(SECRET)));
  assert.equal(uses.at(-1).data.arguments.path, "/contacts");
  const entry = (await L.searchLog({ kind: "change" }))[0];
  assert.deepEqual([entry.area, entry.who, entry.via], ["Sales", "Luis", "mcp"]);
});

test("tokens: an AI's token gets in, a revoked one stops working, and deactivating the person removes them all", async () => {
  const token = await P.createToken(luis.id, "Luis's Claude");
  assert.match(token, /^hub_/);
  assert.equal((await P.personFromToken(token)).id, luis.id);
  assert.equal(await db.queryOne(`select 1 from tokens where fingerprint = $1`, [token]), null);
  assert.equal(await P.personFromToken("hub_invented_0123456789abcdef"), null);
  const [row] = await P.listTokens(luis.id);
  await P.revokeToken(admin.id, row.id);
  assert.ok(await P.personFromToken(token), "nobody revokes another person's token");
  await P.revokeToken(luis.id, row.id);
  assert.equal(await P.personFromToken(token), null);
  const other = await P.createToken(luis.id, "Other");
  const session = await P.createSession(luis.id);
  await P.updatePerson(luis.id, { active: false });
  assert.equal(await P.personFromToken(other), null);
  assert.equal(await P.personFromSession(session.value), null);
});

test("database: every table has RLS enabled", async () => {
  const without = await db.query(`select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity`);
  assert.equal(without.length, 0, `without RLS: ${without.map((t) => t.relname).join(", ")}`);
});
