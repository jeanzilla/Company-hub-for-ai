import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { googleEnabled, googleAuthUrl } from "@/lib/google.ts";
import { internalPath, hubUrl } from "@/lib/url.ts";

export async function GET(req: Request) {
  if (!googleEnabled()) return NextResponse.redirect(new URL("/sign-in", req.url));
  const state = randomBytes(24).toString("base64url");
  const next = internalPath(new URL(req.url).searchParams.get("next"));
  (await cookies()).set("hub_google", `${state}|${next}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/auth", maxAge: 600 });
  return NextResponse.redirect(googleAuthUrl(hubUrl(req), state));
}
