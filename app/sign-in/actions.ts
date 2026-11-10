"use server";
import { redirect } from "next/navigation";
import { signInWithPassword, personFromInvite, redeemInvite } from "@/lib/people.ts";
import { writeLog } from "@/lib/log.ts";
import { openSession } from "@/lib/session.ts";
import { internalPath } from "@/lib/url.ts";

export async function signIn(f: FormData) {
  const next = internalPath(f.get("next"));
  const r = await signInWithPassword(String(f.get("email") ?? ""), String(f.get("password") ?? ""));
  if (!r.ok) redirect(`/sign-in?error=${r.reason}${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`);
  await openSession(r.person.id);
  await writeLog({ person: r.person, via: "web", kind: "usage", title: "Signed in to the hub" });
  redirect(next);
}

export async function setPassword(f: FormData) {
  const code = String(f.get("code") ?? "");
  const password = String(f.get("password") ?? "");
  const goBack = (reason: string) => redirect(`/invite/${encodeURIComponent(code)}?error=${encodeURIComponent(reason)}`);
  if (password !== String(f.get("repeat") ?? "")) goBack("The two passwords do not match");
  const person = await personFromInvite(code);
  let id = "";
  try { id = await redeemInvite(code, password); } catch (e) { goBack(e instanceof Error ? e.message : "Could not save it"); }
  await openSession(id);
  await writeLog({ person: person ? { id, name: person.name } : null, via: "web", kind: "usage", title: "Set a password and signed in to the hub" });
  redirect("/");
}
