// Public address of the hub: HUB_URL if it is set; otherwise the address of the request.
export function hubUrl(req?: Request): string {
  const fixed = (process.env.HUB_URL || "").trim().replace(/\/+$/, "");
  if (fixed) return fixed;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (req) {
    const h = req.headers;
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host) return `${h.get("x-forwarded-proto") || new URL(req.url).protocol.replace(":", "")}://${host}`;
    return new URL(req.url).origin;
  }
  return "http://localhost:3000";
}

/** Internal paths only: stops "?next=" from sending the person to another site after sign-in. */
export function internalPath(next: unknown, fallback = "/"): string {
  const n = String(next || "");
  return n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") ? n : fallback;
}
