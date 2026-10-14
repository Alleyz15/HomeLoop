import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getSessionUser, landingPathFor } from "@/lib/auth";

export default async function HomePage() {
  const user = await getSessionUser();

  return (
    <section className="flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-4xl font-semibold tracking-tight">
        Move to a new SDP home without selling yours first
      </h1>
      <p className="text-lg text-muted-foreground">
        HomeLoop values your current home against real published transactions,
        shows you what a new SDP home would cost on top, and gives you two ways
        to bridge the gap — a direct purchase, or a guaranteed price floor while
        you sell on the open market.
      </p>
      <div className="flex flex-wrap gap-3">
        {user ? (
          <Button render={<Link href={landingPathFor(user.role)} />} size="lg">
            Go to my dashboard
          </Button>
        ) : (
          <>
            <Button render={<Link href="/login?next=/valuation" />} size="lg">
              Value my home for free
            </Button>
            <Button
              render={<Link href="/login" />}
              size="lg"
              variant="outline"
            >
              Sign in
            </Button>
          </>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        A valuation is free and commits you to nothing.
      </p>
    </section>
  );
}
