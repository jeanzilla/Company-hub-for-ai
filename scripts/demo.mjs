#!/usr/bin/env node
// npm run demo: the whole hub on this computer, without creating any account. It starts a Postgres inside Node
// (stored in .demo/), fills it with made-up data, starts a fake outside service to try a connector
// and opens the hub at http://localhost:3000. To start over, delete the .demo/ folder.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { ROOT } from "./lib/env.mjs";
import { startDb } from "./lib/local-db.mjs";
import { migrate } from "./lib/migrations.mjs";

const PORT = Number(process.env.PORT) || 3000, DB_PORT = 54329, SERVICE_PORT = 54330;
const dir = path.join(ROOT, ".demo");
fs.mkdirSync(dir, { recursive: true });
const keysFile = path.join(dir, "keys.json");
const keys = fs.existsSync(keysFile) ? JSON.parse(fs.readFileSync(keysFile, "utf8")) : { encryption: randomBytes(32).toString("base64") };
fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2), { mode: 0o600 });

const db = await startDb({ dir: path.join(dir, "pg"), port: DB_PORT });
Object.assign(process.env, { DATABASE_URL: db.url, HUB_ENCRYPTION_KEY: keys.encryption, HUB_URL: `http://localhost:${PORT}` });
await migrate(db.url, { quiet: true });

// Fake outside service: a "shop" with three orders. It requires the connector's secret.
const SECRET = "example-shop-secret-123456";
const ORDERS = [
  { id: 101, customer: "Marta Ruiz", total: 129.9, status: "shipped" },
  { id: 102, customer: "Vega Workshops", total: 840, status: "pending" },
  { id: 103, customer: "Pablo Soto", total: 59.5, status: "pending" },
];
http.createServer((req, res) => {
  const json = (status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  if (req.headers.authorization !== `Bearer ${SECRET}`) return json(401, { error: "Missing secret" });
  const u = new URL(req.url, "http://x");
  if (req.method === "GET" && u.pathname === "/api/orders") return json(200, ORDERS.filter((o) => !u.searchParams.get("status") || o.status === u.searchParams.get("status")));
  if (req.method === "POST" && u.pathname === "/api/orders") return json(201, { id: 104, created: true });
  json(404, { error: "Not found" });
}).listen(SERVICE_PORT, "127.0.0.1");

const P = await import("../lib/people.ts");
const { saveConnector } = await import("../lib/connectors.ts");
const { createDevice, rotateDeviceKey } = await import("../lib/devices.ts");
const { writeLog } = await import("../lib/log.ts");
const { queryOne, closeDb } = await import("../lib/db.ts");
const { hashPassword } = await import("../lib/secrets.ts");
const { query } = await import("../lib/db.ts");

const PASSWORD = "demo-demo-demo";
if (!(await queryOne(`select 1 from people limit 1`))) {
  await P.saveRole({ slug: "warehouse", name: "Warehouse", description: "Prepares orders and prints labels.", permissions: ["log:read", "log:write", "connector:shop:read", "device:warehouse-printer:use"] });
  const ana = await P.createPerson({ email: "ana@demo.test", name: "Ana Admin", role: "admin" });
  const luis = await P.createPerson({ email: "luis@demo.test", name: "Luis Warehouse", role: "warehouse" });
  await query(`update people set password_hash = $1`, [await hashPassword(PASSWORD)]);
  await saveConnector({ slug: "shop", name: "Online shop (example)", description: "Shop orders: GET /orders (accepts ?status=pending). To create an order, POST /orders; confirm with the person first.", base_url: `http://127.0.0.1:${SERVICE_PORT}/api`, auth_type: "bearer", secret: SECRET }, "Demo");
  keys.device = await createDevice({ slug: "warehouse-printer", name: "Warehouse printer", kind: "printer", location: "Warehouse" });
  await writeLog({ person: { id: ana, name: "Ana Admin" }, via: "web", kind: "decision", area: "Operations", title: "Ana reviews orders over 500 € before they ship", detail: "Agreed with Luis. Until further notice." });
  await writeLog({ person: { id: luis, name: "Luis Warehouse" }, via: "mcp", kind: "change", area: "Operations", title: "Shipping labels with the company name at the top" });
  fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2), { mode: 0o600 });
}
if (!keys.device) { keys.device = await rotateDeviceKey("warehouse-printer"); fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2), { mode: 0o600 }); }
await closeDb();

console.log(`
Demo hub at http://localhost:${PORT}

  Sign in as admin:      ana@demo.test   password: ${PASSWORD}
  Sign in as warehouse:  luis@demo.test  password: ${PASSWORD}

  To see a printer "online", in another terminal:
  HUB_URL=http://localhost:${PORT} HUB_DEVICE_KEY=${keys.device} node devices/agent.mjs

The data is in .demo/ (delete it to start over). Ctrl+C to stop.
`);

const next = spawn(process.execPath, [path.join(ROOT, "node_modules/next/dist/bin/next"), "dev", "-p", String(PORT)], { cwd: ROOT, stdio: "inherit", env: process.env });
const stop = async () => { next.kill("SIGTERM"); await db.stop().catch(() => {}); process.exit(0); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
next.on("exit", stop);
