import { NextResponse } from "next/server";
import { closeSession } from "@/lib/session.ts";

export async function POST(req: Request) {
  await closeSession();
  return NextResponse.redirect(new URL("/sign-in", req.url), 303);
}
