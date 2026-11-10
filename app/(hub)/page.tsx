import Link from "next/link";
import { hub } from "@/hub.config.ts";
import { requireAccess } from "@/lib/session.ts";
import { can } from "@/lib/permissions.ts";
import { searchLog } from "@/lib/log.ts";
import { listTokens } from "@/lib/people.ts";
import { Notice, PageHeader } from "@/components/ui.tsx";
import { Icon } from "@/components/icon.tsx";
import { LogForm, LogList } from "@/components/log.tsx";
import { addLogEntry } from "./actions.ts";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const person = await requireAccess();
  const q = await searchParams;
  const canRead = can(person.permissions, "log:read");
  const [latest, tokens] = await Promise.all([canRead ? searchLog({ excludeUsage: true, limit: 8 }) : [], listTokens(person.id)]);
  const companyPages = hub.menu.filter((e) => can(person.permissions, e.permission));
  return (
    <>
      <PageHeader title={`Hi, ${person.name.split(" ")[0]}`} text={`${hub.name} · ${person.roleName}`} />
      <Notice ok={q.ok} error={q.error ?? (q.notice === "no-permission" ? "Your role does not have permission to open that page. Ask whoever manages the hub." : undefined)} />

      {companyPages.length ? (
        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {companyPages.map((e) => (
            <Link key={e.href} href={e.href} className="card card-pad flex items-center gap-3 no-underline hover:border-line-strong">
              <span className="text-accent"><Icon name={e.icon} size={20} /></span><span className="font-medium text-ink">{e.title}</span>
            </Link>
          ))}
        </section>
      ) : null}

      {!tokens.length ? (
        <section className="card card-pad mb-6 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="section-title">Connect your AI to the hub</h2><p className="page-subtitle">Your assistant will be able to use the tools of your role, and everything it does is saved in the log under your name.</p></div>
          <Link href="/my-ai" className="btn btn-primary">Connect</Link>
        </section>
      ) : null}

      {canRead ? (
        <section className="card mb-6">
          <div className="flex items-center justify-between px-[18px] pb-1 pt-4"><h2 className="section-title">Latest from the team</h2><Link href="/log" className="btn btn-ghost">See all</Link></div>
          <LogList entries={latest} empty="Nothing in the log yet. Add your first decision or change here." />
        </section>
      ) : null}

      {can(person.permissions, "log:write") ? (
        <section className="card card-pad"><h2 className="section-title mb-3">Add something for the team</h2><LogForm action={addLogEntry} returnTo="/" /></section>
      ) : null}
    </>
  );
}
