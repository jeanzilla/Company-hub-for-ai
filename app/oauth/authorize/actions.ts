"use server";
import { redirect } from "next/navigation";
import { clientById, createCode, isValidRedirect } from "@/lib/oauth.ts";
import { writeLog } from "@/lib/log.ts";
import { requireAccess } from "@/lib/session.ts";

export async function decide(f: FormData) {
  const person = await requireAccess();
  const g = (k: string) => String(f.get(k) ?? "");
  const client = await clientById(g("client_id"));
  const redirectUri = g("redirect_uri");
  // Without a client, or with a redirect that is not its own, the person is not sent anywhere.
  if (!client || !isValidRedirect(client, redirectUri) || !g("code_challenge")) redirect("/?error=" + encodeURIComponent("The connection request is not valid"));
  const target = new URL(redirectUri);
  if (g("state")) target.searchParams.set("state", g("state"));
  if (g("decision") === "allow") {
    target.searchParams.set("code", await createCode({ clientId: client.id, personId: person.id, redirectUri, challenge: g("code_challenge") }));
    await writeLog({ person, via: "web", kind: "usage", area: "Hub", title: `Connected an AI to the hub: ${client.name}` });
  } else {
    target.searchParams.set("error", "access_denied");
  }
  redirect(target.toString());
}
