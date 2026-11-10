// The device reports something that happened on site: a card read, a door opened, an alarm.
// It is stored in device_events; the company tools read from there.
import { saveEvent } from "@/lib/devices.ts";
import { jsonBody, callingDevice, invalidKey } from "@/lib/device-http.ts";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const d = await callingDevice(req);
  if (!d) return invalidKey();
  const c = await jsonBody(req);
  if (!c.kind || typeof c.kind !== "string") return Response.json({ ok: false, error: 'Missing "kind"' }, { status: 400 });
  const id = await saveEvent(d.id, c.kind, c.data ?? {});
  return Response.json({ ok: true, id });
}
