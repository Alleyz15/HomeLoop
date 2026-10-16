"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House } from "lucide-react";

import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { brandPathFor, isApplicationPath, type Role } from "@/lib/auth-routing";

type NavigationUser = { email: string | null; role: Role };

const NAVIGATION: Record<Role, Array<{ href: string; label: string }>> = {
  owner: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/valuation", label: "Valuation" },
    { href: "/new-home", label: "New home" },
    { href: "/plans", label: "Plans" },
  ],
  admin: [
    { href: "/admin", label: "Applications" },
    { href: "/admin/simulator", label: "Risk simulator" },
  ],
};

/** Presentation only. Session verification and role authorization stay server-side. */
export function SiteNavigation({ user }: { user: NavigationUser | null }) {
  const pathname = usePathname();
  const applicationUser = isApplicationPath(pathname) ? user : null;
  const links = applicationUser ? NAVIGATION[applicationUser.role] : [];

  return (
    <nav aria-label="Primary navigation"
      className="site-nav mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-5">
      <Link href={brandPathFor(pathname, user?.role)} className="site-brand" aria-label="HomeLoop home">
        <span className="site-brand-mark"><House size={19} strokeWidth={1.6} aria-hidden="true" /></span>
        HomeLoop<span className="brand-period">.</span>
      </Link>
      {links.map((item) => (
        <Link key={item.href} href={item.href}
          className="text-sm font-medium text-muted-foreground hover:text-foreground">
          {item.label}
        </Link>
      ))}
      <div className="ms-auto flex items-center gap-3">
        {applicationUser ? (
          <>
            <span className="text-sm text-muted-foreground">
              {applicationUser.email}
              {applicationUser.role === "admin" ? " · Trade-in team" : null}
            </span>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">Sign out</Button>
            </form>
          </>
        ) : null}
      </div>
    </nav>
  );
}

export function FooterHomeLink({ role }: { role?: Role }) {
  return <Link href={brandPathFor(usePathname(), role)} className="text-sm font-semibold">HomeLoop.</Link>;
}
