import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getSessionUser, type Role } from "@/lib/auth";

import { signOut } from "./auth/actions";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const NAVIGATION: Record<Role | "guest", Array<{ href: string; label: string }>> =
  {
    guest: [{ href: "/", label: "Home" }],
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

export const metadata: Metadata = {
  title: "HomeLoop",
  description: "Home trade-in service prototype for Sime Darby Property.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();
  const links = NAVIGATION[user?.role ?? "guest"];

  return (
    <html lang="en" className={geist.variable}>
      <body className="flex min-h-screen flex-col">
        <header>
          <nav
            aria-label="Primary navigation"
            className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-5"
          >
            <Link href="/" className="text-sm font-semibold">
              HomeLoop
            </Link>

            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}

            <div className="ms-auto flex items-center gap-3">
              {user ? (
                <>
                  <span className="text-sm text-muted-foreground">
                    {user.email}
                    {user.role === "admin" ? " · Trade-in team" : null}
                  </span>
                  <form action={signOut}>
                    <Button type="submit" variant="outline" size="sm">
                      Sign out
                    </Button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="text-sm font-medium">
                  Sign in
                </Link>
              )}
            </div>
          </nav>
          <Separator />
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-1 px-6 py-12">
          {children}
        </main>

        <footer>
          <Separator />
          <p className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted-foreground">
            HomeLoop prices are preliminary estimates based on public NAPIC transaction data, not a formal valuation. Formal valuations are performed by a registered valuer (Act 242).
          </p>
        </footer>
      </body>
    </html>
  );
}
