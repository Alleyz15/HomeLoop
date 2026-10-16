import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { FooterHomeLink, SiteNavigation } from "@/components/site-navigation";
import { Separator } from "@/components/ui/separator";
import { getSessionUser } from "@/lib/auth";

import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

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

  return (
    <html lang="en" className={geist.variable}>
      <body className="flex min-h-screen flex-col">
        <a className="skip-link" href="#main-content">Skip to content</a>
        <header className="site-header">
          <SiteNavigation user={user ? { email: user.email, role: user.role } : null} />
          <Separator />
        </header>

        <main id="main-content" className="site-main mx-auto flex w-full max-w-6xl flex-1 px-6 py-12">
          {children}
        </main>

        <footer className="site-footer">
          <Separator />
          <div className="footer-heading mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 pt-6">
            <FooterHomeLink role={user?.role} />
            <span>Home trade-in service prototype · A clearer way forward</span>
          </div>
          <p className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted-foreground">
            HomeLoop prices are preliminary estimates based on public NAPIC transaction data, not a formal valuation. Formal valuations are performed by a registered valuer (Act 242).
          </p>
        </footer>
      </body>
    </html>
  );
}
