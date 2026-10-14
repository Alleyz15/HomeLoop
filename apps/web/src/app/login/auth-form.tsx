"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register, signIn } from "@/app/auth/actions";
import { emptyAuthState } from "@/app/auth/state";

type Mode = "sign-in" | "register";

export function AuthForm({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [signInState, signInAction, signInPending] = useActionState(
    signIn,
    emptyAuthState,
  );
  const [registerState, registerAction, registerPending] = useActionState(
    register,
    emptyAuthState,
  );

  const isRegister = mode === "register";
  const state = isRegister ? registerState : signInState;
  const pending = isRegister ? registerPending : signInPending;

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Sign in or create an account"
        className="flex gap-1 rounded-lg bg-muted p-1"
      >
        {(
          [
            ["sign-in", "Sign in"],
            ["register", "Create account"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === value
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        key={mode}
        action={isRegister ? registerAction : signInAction}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="next" value={next} />

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            minLength={isRegister ? 8 : undefined}
          />
          {isRegister ? (
            <p className="text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          ) : null}
        </div>

        {state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
        {state.notice ? (
          <p role="status" className="text-sm text-muted-foreground">
            {state.notice}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={pending}>
          {pending
            ? "Working…"
            : isRegister
              ? "Create account"
              : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
