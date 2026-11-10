import { deviceFromKey } from "./devices.ts";

/** The calling device, from its X-Device-Key header. */
export async function callingDevice(req: Request) {
  return deviceFromKey(req.headers.get("x-device-key"));
}

export const invalidKey = () => Response.json({ ok: false, error: "Invalid device key" }, { status: 401 });

export async function jsonBody(req: Request): Promise<Record<string, unknown>> {
  try { const j = await req.json(); return j && typeof j === "object" ? (j as Record<string, unknown>) : {}; } catch { return {}; }
}
