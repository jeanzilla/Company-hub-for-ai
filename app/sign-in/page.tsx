import { redirect } from "next/navigation";
import { queryOne } from "@/lib/db.ts";
import { googleEnabled } from "@/lib/google.ts";
import { currentPerson } from "@/lib/session.ts";
import { internalPath } from "@/lib/url.ts";
import { Field } from "@/components/ui.tsx";
import { EntryCard } from "@/components/entry-card.tsx";
import { signIn } from "./actions.ts";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  credentials: "The email or the password is not correct.",
  locked: "Too many attempts in a row. Wait 15 minutes and try again.",
  google: "Could not sign in with Google. Try again.",
  "not-registered": "That Google account is not registered in this hub. Ask whoever manages it to add you.",
};

export default async function SignIn({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const q = await searchParams;
  const next = internalPath(q.next);
  if (await currentPerson()) redirect(next);
  const empty = !(await queryOne(`select 1 from people limit 1`));
  return (
    <EntryCard title="Sign in">
      {empty ? <p className="notice notice-warn mb-4">This hub has no people yet. Create the first person from a terminal: <span className="mono">npm run admin -- you@company.com</span></p> : null}
      {q.error && ERRORS[q.error] ? <p className="notice notice-bad mb-4" role="alert">{ERRORS[q.error]}</p> : null}
      <form action={signIn} className="grid gap-3">
        <input type="hidden" name="next" value={next} />
        <Field label="Email"><input name="email" type="email" className="field" required autoComplete="username" autoFocus /></Field>
        <Field label="Password"><input name="password" type="password" className="field" required autoComplete="current-password" /></Field>
        <button className="btn btn-primary mt-1" type="submit">Sign in</button>
      </form>
      {googleEnabled() ? <a className="btn mt-3 w-full" href={`/auth/google?next=${encodeURIComponent(next)}`}>Sign in with Google</a> : null}
      <p className="hint mt-4">If you forgot your password, ask whoever manages the hub for a new link.</p>
    </EntryCard>
  );
}
