import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionUser, landingPathFor } from "@/lib/auth";

import { AuthForm } from "./auth-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getSessionUser();
  if (user) {
    redirect(landingPathFor(user.role));
  }

  const { next } = await searchParams;

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground">
          A HomeLoop account is needed to value your home. Valuations are free,
          and you are not committed to anything by looking.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email and password</CardTitle>
          <CardDescription>
            Use the same details to come back to an application in progress.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm next={next ?? ""} />
        </CardContent>
      </Card>
    </section>
  );
}
