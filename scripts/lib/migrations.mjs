// Applies, in order, the files in db/migrations that are missing and records each one in the hub_migrations table.
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { ROOT } from "./env.mjs";

export async function migrate(url, { quiet = false } = {}) {
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const sql = postgres(url, { prepare: false, max: 1, ssl: local ? false : "require", onnotice: () => {} });
  try {
    await sql.unsafe(`create table if not exists hub_migrations (name text primary key, applied_at timestamptz not null default now());
                      alter table hub_migrations enable row level security;`);
    const applied = new Set((await sql.unsafe(`select name from hub_migrations`)).map((row) => row.name));
    const dir = path.join(ROOT, "db/migrations");
    const pending = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().filter((f) => !applied.has(f));
    for (const f of pending) {
      await sql.unsafe(`begin;\n${fs.readFileSync(path.join(dir, f), "utf8")}\n;insert into hub_migrations (name) values ('${f.replace(/'/g, "")}');\ncommit;`)
        .catch(async (e) => { await sql.unsafe("rollback").catch(() => {}); throw new Error(`${f}: ${e.message}`); });
      if (!quiet) console.log(`✓ ${f}`);
    }
    if (!quiet && !pending.length) console.log("The database is already up to date.");
    return pending;
  } finally { await sql.end({ timeout: 5 }); }
}
