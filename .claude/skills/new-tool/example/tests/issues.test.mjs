// Test of a company tool: its functions and its permission over MCP.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { startDb } from "../scripts/lib/local-db.mjs";
import { migrate } from "../scripts/lib/migrations.mjs";

let base, db, I, M, proto;
before(async () => {
  base = await startDb();
  process.env.DATABASE_URL = base.url;
  await migrate(base.url, { quiet: true });
  db = await import("../lib/db.ts");
  I = await import("../tools/issues.ts");
  M = await import("../lib/mcp/server.ts");
  proto = await import("../lib/mcp/protocol.ts");
});
after(async () => { await db?.closeDb(); await base?.stop(); });

const person = (permissions) => ({ id: null, name: "Luis", email: "luis@example.test", role: "x", roleName: "Test", permissions });
const call = (p, name, args = {}) => proto.handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, M.serverFor(p));

test("issues: they are created, listed and resolved only once", async () => {
  const id = await I.createIssue("The warehouse door does not close", "", "Luis");
  await assert.rejects(I.createIssue("x", "", "Luis"), /too short/);
  assert.equal((await I.listIssues("open")).length, 1);
  assert.ok(await I.resolveIssue(id, "Ana"));
  assert.ok(!(await I.resolveIssue(id, "Ana")));
  assert.equal((await I.listIssues("open")).length, 0);
});

test("issues: over MCP only people with the permission can use them", async () => {
  const allowed = person(["tool:issues"]), denied = person(["log:read"]);
  assert.ok(M.toolsFor(allowed.permissions).some((t) => t.name === "issue_create"));
  assert.ok(!M.toolsFor(denied.permissions).some((t) => t.name.startsWith("issue")));
  const r = await call(allowed, "issue_create", { title: "The printer is out of paper" });
  assert.ok(!r.result.isError && JSON.parse(r.result.content[0].text).created);
  assert.equal((await call(denied, "issue_create", { title: "Should not work" })).error.code, -32602);
  assert.equal((await db.query(`select tool, who from log where tool = 'issue_create'`))[0].who, "Luis");
});
