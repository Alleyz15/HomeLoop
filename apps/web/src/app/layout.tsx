import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";

import { Separator } from "@/components/ui/separator";

import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const navigation = [
  { href: "/", label: "Home" },
  { href: "/valuation", label: "Valuation" },
  { href: "/plans", label: "Plans" },
  { href: "/new-home", label: "New home" },
  { href: "/guide", label: "Guide" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/login", label: "Login" },
];

export const metadata: Metadata = {
  title: "HomeLoop",
  description: "Home trade-in service prototype for Sime Darby Property.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="flex min-h-screen flex-col">
        <header>
          <nav
            aria-label="Primary navigation"
            className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-5"
          >
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm font-medium">
                {item.label}
              </Link>
            ))}
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
