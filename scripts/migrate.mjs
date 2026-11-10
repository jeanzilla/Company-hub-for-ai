#!/usr/bin/env node
// npm run migrate: brings the database at DATABASE_URL up to date with db/migrations.
import { loadEnv } from "./lib/env.mjs";
import { migrate } from "./lib/migrations.mjs";

loadEnv();
if (!process.env.DATABASE_URL) { console.error("Missing DATABASE_URL (in .env.local or in the environment)."); process.exit(1); }
migrate(process.env.DATABASE_URL).catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
