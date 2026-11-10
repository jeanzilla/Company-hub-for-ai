// The device confirms a job: {ok: true} if it did it, {ok: false, result: "reason"} if it failed.
import { finishJob } from "@/lib/devices.ts";
import { writeLog } from "@/lib/log.ts";
import { jsonBody, callingDevice, invalidKey } from "@/lib/device-http.ts";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const d = await callingDevice(req);
  if (!d) return invalidKey();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ ok: false, error: "Unknown job" }, { status: 404 });
  const c = await jsonBody(req);
  const ok = c.ok !== false;
  const closed = await finishJob(d.id, id, ok, String(c.result ?? ""));
  if (closed && !ok) await writeLog({ who: d.name, via: "device", kind: "usage", title: "Job failed", detail: String(c.result ?? "").slice(0, 500), tool: d.slug, ok: false });
  // If it was already closed the answer is the same: the device can repeat the confirmation safely.
  return Response.json({ ok: true, closed });
}
