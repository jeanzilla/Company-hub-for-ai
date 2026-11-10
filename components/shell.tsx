// Hub shell: a white 240 px side menu on desktop; on phones, a top bar and the menu in a drawer
// that opens without JavaScript (hidden checkbox). Each entry asks for a permission: whoever lacks it does not see it.
import Link from "next/link";
import { hub } from "@/hub.config.ts";
import { can } from "@/lib/permissions.ts";
import type { Person } from "@/lib/people.ts";
import { Icon } from "./icon.tsx";
import { MenuLink } from "./menu-link.tsx";

type Entry = { href: string; title: string; icon: string; permission?: string };

const MAIN: Entry[] = [
  { href: "/", title: "Home", icon: "home" },
  { href: "/log", title: "Log", icon: "log", permission: "log:read" },
  { href: "/my-ai", title: "My AI", icon: "ai" },
];
const ADMIN: Entry[] = [
  { href: "/team", title: "Team", icon: "team", permission: "team:manage" },
  { href: "/connectors", title: "Connectors", icon: "connector", permission: "connectors:manage" },
  { href: "/devices", title: "Devices", icon: "device", permission: "devices:manage" },
];

export function Shell({ person, children }: { person: Person; children: React.ReactNode }) {
  const sees = (e: Entry) => !e.permission || can(person.permissions, e.permission);
  const groups = [
    { title: "", entries: MAIN.filter(sees) },
    { title: "Tools", entries: hub.menu.filter(sees) },
    { title: "Admin", entries: ADMIN.filter(sees) },
  ].filter((g) => g.entries.length);

  return (
    <div className="min-h-dvh">
      <input type="checkbox" id="drawer" className="peer hidden" aria-hidden="true" />
      <div className="fixed inset-x-0 top-0 z-30 flex h-13 items-center gap-2 border-b border-line bg-surface px-3 md:hidden">
        <label htmlFor="drawer" className="btn btn-ghost" aria-label="Open the menu"><Icon name="menu" size={20} /></label>
        <span className="font-semibold text-ink">{hub.name}</span>
      </div>
      <label htmlFor="drawer" className="fixed inset-0 z-40 hidden bg-black/35 peer-checked:block md:hidden" aria-label="Close the menu" />
      <aside className="fixed inset-y-0 left-0 z-50 flex w-[min(280px,84vw)] -translate-x-full flex-col overflow-y-auto border-r border-line bg-surface transition-transform duration-200 peer-checked:translate-x-0 md:w-60 md:translate-x-0">
        <Link href="/" className="flex items-center gap-2.5 px-5 pb-3 pt-5 no-underline">
          <span className="grid size-7 place-items-center rounded-lg bg-accent text-[13px] font-semibold text-white">{hub.name.slice(0, 1).toUpperCase()}</span>
          <span className="truncate text-[15px] font-semibold text-ink">{hub.name}</span>
        </Link>
        <nav className="flex-1 px-3 pb-4" aria-label="Main menu">
          {groups.map((g) => (
            <div key={g.title} className="mt-3">
              {g.title ? <p className="micro px-3 pb-1.5 pt-2">{g.title}</p> : null}
              {g.entries.map((e) => <MenuLink key={e.href} href={e.href}><Icon name={e.icon} />{e.title}</MenuLink>)}
            </div>
          ))}
        </nav>
        <div className="border-t border-line px-3 py-3">
          <div className="px-3 pb-2">
            <p className="truncate text-[13px] font-medium text-ink">{person.name}</p>
            <p className="truncate text-[12px] text-muted">{person.roleName}</p>
          </div>
          <form action="/sign-out" method="post">
            <button className="menu-item w-full cursor-pointer" type="submit"><Icon name="sign-out" />Sign out</button>
          </form>
        </div>
      </aside>
      <div className="pt-13 md:ml-60 md:pt-0">
        <main className="mx-auto max-w-[1100px] px-4 pb-16 pt-5 md:px-8 md:pt-8">{children}</main>
      </div>
    </div>
  );
}
