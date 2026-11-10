#!/usr/bin/env node
// npm run admin -- you@company.com ["Name"]
// Creates the first person in the hub (or gives access back to whoever manages it) and prints the link to set
// their password. It runs from a terminal with access to the database: that is why it asks for no other key.
import { loadEnv } from "./lib/env.mjs";

loadEnv();
const [email, name] = process.argv.slice(2);
if (!email || !email.includes("@")) { console.error('Usage: npm run admin -- you@company.com ["Name"]'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error("Missing DATABASE_URL (in .env.local or in the environment)."); process.exit(1); }

const P = await import("../lib/people.ts");
const { writeLog } = await import("../lib/log.ts");
const { closeDb } = await import("../lib/db.ts");
try {
  let person = await P.personByEmail(email);
  let id = person?.id;
  if (!id) id = await P.createPerson({ email, name: name || "", role: "admin" });
  else await P.updatePerson(id, { role: "admin", active: true });
  const code = await P.createInvite(id);
  await writeLog({ via: "system", kind: "change", area: "Hub", who: "Terminal", title: `Admin access for ${P.normalizeEmail(email)}` });
  const hub = (process.env.HUB_URL || "http://localhost:3000").replace(/\/+$/, "");
  console.log(`\n✓ ${P.normalizeEmail(email)} manages the hub.\n\nOpen this link to set the password (valid for 7 days, single use):\n\n  ${hub}/invite/${code}\n`);
} catch (e) { console.error(`✗ ${e.message}`); process.exitCode = 1; } finally { await closeDb(); }
