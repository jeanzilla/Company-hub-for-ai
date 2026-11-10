import Link from "next/link";
import { redirect } from "next/navigation";
import { clientById, isValidRedirect } from "@/lib/oauth.ts";
import { toolsFor } from "@/lib/mcp/server.ts";
import { currentPerson } from "@/lib/session.ts";
import { EntryCard } from "@/components/entry-card.tsx";
import { decide } from "./actions.ts";

export const dynamic = "force-dynamic";

/** Permission page: an AI asks to connect to the hub in the name of the person who is signed in. */
export default async function Authorize({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const q = await searchParams;
  const person = await currentPerson();
  if (!person) redirect(`/sign-in?next=${encodeURIComponent(`/oauth/authorize?${new URLSearchParams(q)}`)}`);
  const client = q.client_id ? await clientById(q.client_id) : null;
  const valid = !!client && isValidRedirect(client, q.redirect_uri || "") && q.response_type === "code" && !!q.code_challenge && (q.code_challenge_method || "S256") === "S256";
  if (!valid) {
    return <EntryCard title="Cannot connect" text="The request from this program is not valid. Start the connection again from your AI."><Link className="btn" href="/">Go to the hub</Link></EntryCard>;
  }
  const tools = toolsFor(person.permissions);
  const returnHost = new URL(q.redirect_uri).host;
  return (
    <EntryCard title="Connect an AI" text={`"${client.name}" wants to use the hub in your name, ${person.name}.`}>
      <p className="mb-2 text-[13.5px]">It will be able to use the {tools.length} tools of your role ({person.roleName}):</p>
      <ul className="mb-4 grid gap-1 text-[13px] text-muted">{tools.slice(0, 8).map((h) => <li key={h.name}>· {h.title}</li>)}{tools.length > 8 ? <li>· and {tools.length - 8} more</li> : null}</ul>
      <p className="hint mb-4">Everything it does is saved in the log under your name. You can disconnect it in &quot;My AI&quot;. When you accept, you go back to <span className="mono">{returnHost}</span>.</p>
      <form action={decide} className="flex gap-2">
        {["client_id", "redirect_uri", "state", "code_challenge"].map((k) => <input key={k} type="hidden" name={k} value={q[k] ?? ""} />)}
        <button className="btn btn-primary flex-1" name="decision" value="allow" type="submit">Allow</button>
        <button className="btn flex-1" name="decision" value="cancel" type="submit">Cancel</button>
      </form>
    </EntryCard>
  );
}
