// Postgres connection. One way to talk to the database across the whole hub: query(sql, params).
// Any Postgres works: Supabase (through the "Transaction pooler"), Neon, your own or the one from "npm run demo".
import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;
const g = globalThis as unknown as { __hubSql?: Sql };

export function sql(): Sql {
  if (!g.__hubSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is missing (see .env.example)");
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    g.__hubSql = postgres(url, {
      prepare: false,                     // required with the Supabase pooler
      max: Number(process.env.HUB_DB_CONNECTIONS) || 5,
      idle_timeout: 20,
      connect_timeout: 15,
      ssl: local ? false : "require",
      onnotice: () => {},
    });
  }
  return g.__hubSql;
}

/**
 * Runs a query with parameters ($1, $2...) and returns the rows.
 * For a jsonb column, pass the object as it is and write `$1::jsonb`: the driver converts it.
 * For a text[] column, pass the list and write `array(select jsonb_array_elements_text($1::jsonb))`.
 */
export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const rows = await sql().unsafe(text, params as never[]);
  return rows as unknown as T[];
}

/** The first row, or null. */
export async function queryOne<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await query<T>(text, params))[0] ?? null;
}

/** Marks a value that goes to a `::jsonb` parameter. Do not turn it into text first: it would be stored as a string. */
export const json = (value: unknown): unknown => value ?? null;

export async function closeDb() {
  if (g.__hubSql) { await g.__hubSql.end({ timeout: 5 }); g.__hubSql = undefined; }
}
