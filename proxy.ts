// Before every page: anyone without a session cookie goes to /sign-in. This is a fast first filter; the real
// check (live session, active person and permission) is done by requireAccess() in every page and every action.
import { NextResponse, type NextRequest } from "next/server";

// Paths that identify the caller their own way (token, device key) or that have to be public.
const PUBLIC_PATHS = ["/oauth", "/sign-in", "/invite", "/auth", "/sign-out", "/api/mcp", "/api/devices", "/api/oauth", "/api/health", "/.well-known"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (request.cookies.get("hub_session")?.value) return NextResponse.next();
  const target = new URL("/sign-in", request.url);
  if (pathname !== "/") target.searchParams.set("next", pathname + search);
  return NextResponse.redirect(target);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|svg|ico|webp)$).*)"] };
