import { Shell } from "@/components/shell.tsx";
import { requireAccess } from "@/lib/session.ts";

export const dynamic = "force-dynamic";

export default async function Hub({ children }: { children: React.ReactNode }) {
  const person = await requireAccess();
  return <Shell person={person}>{children}</Shell>;
}
