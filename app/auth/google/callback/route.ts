import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { googleEmail, googleEnabled } from "@/lib/google.ts";
import { personByEmail } from "@/lib/people.ts";
import { writeLog } from "@/lib/log.ts";
import { openSession } from "@/lib/session.ts";
import { hubUrl } from "@/lib/url.ts";

export async function GET(req: Request) {
  const hub = hubUrl(req);
  const fail = (reason: string) => NextResponse.redirect(`${hub}/sign-in?error=${reason}`);
  if (!googleEnabled()) return fail("google");
  const q = new URL(req.url).searchParams;
  const jar = await cookies();
  const [state, next = "/"] = (jar.get("hub_google")?.value || "").split("|");
  jar.delete({ name: "hub_google", path: "/auth" });
  if (!state || state !== q.get("state") || !q.get("code")) return fail("google");
  const email = await googleEmail(hub, q.get("code")!);
  if (!email) return fail("google");
  const person = await personByEmail(email);
  if (!person) return fail("not-registered");
  await openSession(person.id);
  await writeLog({ person, via: "web", kind: "usage", title: "Signed in to the hub", detail: "With Google" });
  return NextResponse.redirect(`${hub}${next}`);
}
