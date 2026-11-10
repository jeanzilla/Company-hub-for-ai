// Heartbeat of a device. It calls every 15 seconds with its key; the hub returns its pending jobs.
// Contract: 200 with {jobs}, 401 if the key is not valid. On a 5xx the device retries on its next round.
import { heartbeat } from "@/lib/devices.ts";
import { jsonBody, callingDevice, invalidKey } from "@/lib/device-http.ts";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const d = await callingDevice(req);
  if (!d) return invalidKey();
  const { status } = await jsonBody(req);
  const jobs = await heartbeat(d.id, status && typeof status === "object" ? (status as Record<string, unknown>) : undefined);
  return Response.json({
    ok: true, device: d.slug, next_in: 15,
    jobs: jobs.map((j) => ({ id: j.id, kind: j.kind, payload: j.payload, attempt: j.attempts })),
  });
}
