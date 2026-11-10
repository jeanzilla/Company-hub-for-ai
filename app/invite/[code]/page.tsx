import Link from "next/link";
import { MIN_PASSWORD_LENGTH } from "@/lib/secrets.ts";
import { personFromInvite } from "@/lib/people.ts";
import { Field } from "@/components/ui.tsx";
import { EntryCard } from "@/components/entry-card.tsx";
import { setPassword } from "@/app/sign-in/actions.ts";

export const dynamic = "force-dynamic";

export default async function Invite({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string>> }) {
  const { code } = await params;
  const q = await searchParams;
  const person = await personFromInvite(code);
  if (!person) {
    return (
      <EntryCard title="Link expired" text="This link has already been used or is more than 7 days old. Ask whoever manages the hub for a new one.">
        <Link className="btn" href="/sign-in">Go to sign in</Link>
      </EntryCard>
    );
  }
  return (
    <EntryCard title={`Hi, ${person.name.split(" ")[0]}`} text={`Set the password you will use to sign in as ${person.email}.`}>
      {q.error ? <p className="notice notice-bad mb-4" role="alert">{q.error}</p> : null}
      <form action={setPassword} className="grid gap-3">
        <input type="hidden" name="code" value={code} />
        <input type="text" name="email" defaultValue={person.email} autoComplete="username" readOnly hidden />
        <Field label="Password" hint={`At least ${MIN_PASSWORD_LENGTH} characters. A phrase works better than a single word.`}>
          <input name="password" type="password" className="field" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" autoFocus />
        </Field>
        <Field label="Repeat it"><input name="repeat" type="password" className="field" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" /></Field>
        <button className="btn btn-primary mt-1" type="submit">Save and sign in</button>
      </form>
    </EntryCard>
  );
}
