"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Menu entry that marks itself when it is the open page, and closes the phone drawer when tapped. */
export function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
  return (
    <Link href={href} className="menu-item" aria-current={active ? "page" : undefined}
      onClick={() => { const c = document.getElementById("drawer") as HTMLInputElement | null; if (c) c.checked = false; }}>
      {children}
    </Link>
  );
}
