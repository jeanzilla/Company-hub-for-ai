// Parts that need no database: permissions, encryption, passwords and the MCP protocol.
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { z } from "zod";

process.env.HUB_ENCRYPTION_KEY = randomBytes(32).toString("base64");
const { can, hasAny, isPermission } = await import("../lib/permissions.ts");
const { encrypt, decrypt } = await import("../lib/crypto.ts");
const { hashPassword, verifyPassword, fingerprint, newSecret } = await import("../lib/secrets.ts");
const { handleMessage } = await import("../lib/mcp/protocol.ts");
const { summarizeArgs } = await import("../lib/log.ts");

test("permissions: exact match and wildcards", () => {
  assert.ok(can(["*"], "connector:crm:write"));
  assert.ok(can(["log:read"], "log:read"));
  assert.ok(!can(["log:read"], "log:write"));
  assert.ok(can(["connector:*:read"], "connector:crm:read"));
  assert.ok(!can(["connector:*:read"], "connector:crm:write"));
  assert.ok(can(["connector:crm:*"], "connector:crm:write"));
  assert.ok(can(["connector:*"], "connector:crm:write"));
  assert.ok(!can(["connector:crm:read"], "connector:bank:read"));
  assert.ok(!can(["connector:crm"], "connector:crm:read"), "a shorter permission without a wildcard does not open the longer ones");
  assert.ok(!can([], "log:read"));
  assert.ok(hasAny(["connector:crm:read"], "connector"));
  assert.ok(!hasAny(["connectors:manage"], "connector"));
  assert.ok(isPermission("connector:crm:read") && isPermission("*") && !isPermission("Connector Crm") && !isPermission("a;drop"));
});

test("encryption: round trip, and tampered data does not decrypt", () => {
  const c = encrypt("test-secret-é-123");
  assert.match(c, /^v1\./);
  assert.ok(!c.includes("test-secret"));
  assert.equal(decrypt(c), "test-secret-é-123");
  assert.notEqual(encrypt("x"), encrypt("x"), "each encryption carries its own IV");
  const parts = c.split("."); parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("AA") ? "BB" : "AA");
  assert.throws(() => decrypt(parts.join(".")));
});

test("passwords: scrypt, and the fingerprint does not reveal the secret", async () => {
  const h = await hashPassword("a long password");
  assert.match(h, /^scrypt\$/);
  assert.ok(await verifyPassword("a long password", h));
  assert.ok(!(await verifyPassword("another", h)));
  assert.ok(!(await verifyPassword("x", null)));
  const s = newSecret("hub");
  assert.match(s, /^hub_[\w-]{40,}$/);
  assert.equal(fingerprint(s).length, 64);
});

test("log: arguments are stored without secrets and shortened", () => {
  const r = summarizeArgs({ path: "/v1/x", token: "abc", body: { a: "y".repeat(2000) } });
  assert.equal(r.token, "[hidden]");
  assert.equal(r.path, "/v1/x");
  assert.ok(String(r.body).length < 700);
});

const toolNamed = (name, run) => ({
  name, title: name, description: "test", permission: "x", input: z.object({ n: z.number().optional() }), run,
});
const server = (tools, calls = []) => ({
  name: "Test", version: "1", instructions: "i", tools: () => tools,
  call: async (t, a) => { calls.push([t.name, a]); return t.run(a); },
});

test("MCP: initialize, list, call, errors and notifications", async () => {
  const calls = [];
  const s = server([toolNamed("sum", async (a) => ({ double: (a.n ?? 0) * 2 })), toolNamed("broken", async () => { throw new Error("it fails"); })], calls);
  const init = await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, s);
  assert.equal(init.result.protocolVersion, "2025-06-18");
  assert.equal(init.result.serverInfo.name, "Test");
  assert.equal((await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999-01-01" } }, s)).result.protocolVersion, "2025-11-25");
  assert.equal(await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, s), null);
  const list = await handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, s);
  assert.deepEqual(list.result.tools.map((t) => t.name), ["sum", "broken"]);
  assert.equal(list.result.tools[0].inputSchema.type, "object");
  const ok = await handleMessage({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "sum", arguments: { n: 4 } } }, s);
  assert.deepEqual(JSON.parse(ok.result.content[0].text), { double: 8 });
  const badArg = await handleMessage({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "sum", arguments: { n: "four" } } }, s);
  assert.ok(badArg.result.isError);
  assert.equal(calls.length, 1, "with bad arguments the tool never runs");
  const broken = await handleMessage({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "broken" } }, s);
  assert.ok(broken.result.isError && broken.result.content[0].text.includes("it fails"));
  assert.equal((await handleMessage({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "other" } }, s)).error.code, -32602);
  assert.equal((await handleMessage({ jsonrpc: "2.0", id: 7, method: "resources/list" }, s)).error.code, -32601);
  assert.equal((await handleMessage({ id: 8 }, s)).error.code, -32600);
});
