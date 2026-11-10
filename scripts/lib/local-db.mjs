// A real Postgres inside Node (PGlite), listening on a local port. "npm run demo" and the tests use it:
// the whole hub can be tried without creating any account or touching the company's data.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

// PGlite serves a single real connection. If the hub opens several, two queries with parameters that arrive at
// the same time can get mixed up. That is why HUB_DB_CONNECTIONS=1 is set here: queries line up on one connection.
// With a normal Postgres (Supabase, Neon…) this limit does not exist.

/** @param {{ dir?: string, port?: number }} [o] dir is the folder where the data is kept (without it, in memory) */
export async function startDb({ dir, port = 0 } = {}) {
  process.env.HUB_DB_CONNECTIONS = "1";
  const db = await PGlite.create(dir ? { dataDir: dir } : {});
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 10 });
  const listening = new Promise((ok) => server.once?.("listening", ok) ?? ok());
  await server.start();
  await Promise.race([listening, new Promise((ok) => setTimeout(ok, 300))]);
  const actualPort = server.server?.address?.()?.port ?? port;
  return {
    url: `postgresql://postgres:postgres@127.0.0.1:${actualPort}/postgres`,
    stop: async () => { await server.stop(); await db.close(); },
  };
}
