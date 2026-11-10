"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/session.ts";
import { writeLog } from "@/lib/log.ts";
import { createIssue, PERMISSION, resolveIssue } from "@/tools/issues.ts";

// Every action: require the permission, do the work, write it to the log and go back to the screen with a message.
async function goBack(error: string, ok: string): Promise<never> {
  revalidatePath("/issues");
  redirect(`/issues?${error ? `error=${encodeURIComponent(error)}` : `ok=${encodeURIComponent(ok)}`}`);
}

export async function create(f: FormData) {
  const me = await requireAccess(PERMISSION);
  let error = "";
  try {
    const title = String(f.get("title") ?? "");
    await createIssue(title, String(f.get("detail") ?? ""), me.name);
    await writeLog({ person: me, via: "web", kind: "usage", area: "Operations", title: "Issue reported", detail: title.slice(0, 200), tool: "issue_create" });
  } catch (e) { error = e instanceof Error ? e.message : "The issue could not be reported"; }
  await goBack(error, "Issue reported.");
}

export async function resolve(f: FormData) {
  const me = await requireAccess(PERMISSION);
  const id = String(f.get("id") ?? "");
  const done = /^\d+$/.test(id) && (await resolveIssue(id, me.name));
  if (done) await writeLog({ person: me, via: "web", kind: "usage", area: "Operations", title: "Issue resolved", tool: "issue_resolve", data: { id } });
  await goBack(done ? "" : "That issue was already resolved.", "Resolved.");
}
