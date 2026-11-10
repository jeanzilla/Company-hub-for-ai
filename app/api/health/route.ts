import { queryOne } from "@/lib/db.ts";

export const dynamic = "force-dynamic";

/** Lets an outside monitor check that the hub responds and reaches its database. It says nothing else. */
export async function GET() {
  try { await queryOne("select 1"); return Response.json({ ok: true }); }
  catch { return Response.json({ ok: false }, { status: 503 }); }
}
