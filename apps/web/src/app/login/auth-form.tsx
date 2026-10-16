"use client";

import { useActionState, useRef, useState } from "react";
import { ArrowUpRight, CircleAlert, CircleCheck, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register, signIn } from "@/app/auth/actions";
import { emptyAuthState } from "@/app/auth/state";
import styles from "./login.module.css";

type Mode = "sign-in" | "register";

export function AuthForm({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [showPassword, setShowPassword] = useState(false);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
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
  const anyPending = signInPending || registerPending;

  function selectMode(value: Mode) {
    setMode(value);
    setShowPassword(false);
  }

  return (
    <div className={styles.authForm}>
      <div
        role="tablist"
        aria-label="Sign in or create an account"
        className={styles.tabs}
        data-register={isRegister}
      >
        <span className={styles.tabIndicator} aria-hidden="true" />
        {(
          [
            ["sign-in", "Sign in"],
            ["register", "Create account"],
          ] as const
        ).map(([value, label], index) => (
          <button
            key={value}
            ref={(element) => { tabs.current[index] = element; }}
            id={`auth-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={mode === value}
            aria-controls="auth-panel"
            tabIndex={mode === value ? 0 : -1}
            disabled={anyPending}
            onClick={() => selectMode(value)}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const target = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
              selectMode(target === 0 ? "sign-in" : "register");
              tabs.current[target]?.focus();
            }}
            className={styles.tab}
          >
            {label}
          </button>
        ))}
      </div>

      <div id="auth-panel" role="tabpanel" aria-labelledby={`auth-tab-${mode}`}>
      <div className={styles.formIntro} key={`intro-${mode}`}>
        <p className={styles.formEyebrow}>YOUR HOMELOOP JOURNEY</p>
        <h1>{isRegister ? "Create your account." : "Sign in"}</h1>
        <p>{isRegister
          ? "Start with a clearer picture of your home's value. Your account is free."
          : "Good to see you again. Sign in to continue your home journey."}</p>
      </div>
      <form
        key={mode}
        action={isRegister ? registerAction : signInAction}
        className={styles.form}
        aria-busy={pending}
      >
        <input type="hidden" name="next" value={next} />

        <div className={styles.field}>
          <Label htmlFor="email">Email address</Label>
          <div className={styles.inputWrap}>
          <Mail size={17} aria-hidden="true" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            disabled={pending}
          />
          </div>
        </div>

        <div className={styles.field}>
          <Label htmlFor="password">Password</Label>
          <div className={`${styles.inputWrap} ${styles.passwordWrap}`}>
          <LockKeyhole size={17} aria-hidden="true" />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            minLength={isRegister ? 8 : undefined}
            aria-describedby={isRegister ? "password-guidance" : undefined}
            placeholder={isRegister ? "At least 8 characters" : "Enter your password"}
            disabled={pending}
          />
          <button type="button" className={styles.passwordToggle}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword} aria-controls="password" disabled={pending}
            onClick={() => setShowPassword((visible) => !visible)}>
            {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
          </button>
          </div>
          {isRegister ? (
            <p id="password-guidance" className={styles.guidance}>
              At least 8 characters.
            </p>
          ) : null}
        </div>

        {state.error ? (
          <p role="alert" className={`${styles.message} ${styles.error}`}>
            <CircleAlert size={17} aria-hidden="true" /><span>{state.error}</span>
          </p>
        ) : null}
        {state.notice ? (
          <p role="status" className={`${styles.message} ${styles.notice}`}>
            <CircleCheck size={17} aria-hidden="true" /><span>{state.notice}</span>
          </p>
        ) : null}

        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? <LoaderCircle size={18} className={styles.spinner} aria-hidden="true" /> : null}
          {pending
            ? isRegister ? "Creating account…" : "Signing in…"
            : isRegister
              ? "Create account"
              : "Sign in"}
          {!pending ? <ArrowUpRight size={18} aria-hidden="true" /> : null}
        </button>
        <span className={styles.srOnly} role="status">{pending ? isRegister ? "Creating account…" : "Signing in…" : ""}</span>
      </form>
      </div>
      <p className={styles.formFootnote}>Free preliminary valuations.<br />No obligation to proceed.</p>
    </div>
  );
}
