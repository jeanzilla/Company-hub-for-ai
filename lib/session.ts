// Who is using the hub in this request. The cookie holds a random value; the database holds only its fingerprint.
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { deleteSession, createSession, personFromSession, type Person } from "./people.ts";
import { can } from "./permissions.ts";

export const COOKIE = "hub_session";

/** The signed-in person, or null. Resolved once per request. */
export const currentPerson = cache(async (): Promise<Person | null> => personFromSession((await cookies()).get(COOKIE)?.value));

/**
 * For pages and actions: returns the person or sends them to sign in. With `permission`, it also requires that permission.
 * Every page in app/(hub) and every server action starts by calling this function.
 */
export async function requireAccess(permission?: string): Promise<Person> {
  const person = await currentPerson();
  if (!person) redirect("/sign-in");
  if (permission && !can(person.permissions, permission)) redirect("/?notice=no-permission");
  return person;
}

export async function openSession(personId: string) {
  const s = await createSession(personId);
  (await cookies()).set(COOKIE, s.value, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: s.expires,
  });
}

export async function closeSession() {
  const store = await cookies();
  await deleteSession(store.get(COOKIE)?.value);
  store.delete(COOKIE);
}
