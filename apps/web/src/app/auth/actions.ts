"use server";

import { redirect } from "next/navigation";

import type { AuthState } from "@/app/auth/state";
import { getSessionUser, landingPathFor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const MIN_PASSWORD_LENGTH = 8;

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    next: String(formData.get("next") ?? "").trim(),
  };
}

/** Only allow in-app relative paths, so `next` cannot send users off-site. */
function safeNext(next: string): string | null {
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export async function signIn(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password, next } = readCredentials(formData);
  if (!email || !password) {
    return { error: "Enter your email address and password.", notice: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Deliberately not saying which field was wrong.
    return { error: "Those details do not match an account.", notice: null };
  }

  const user = await getSessionUser();
  redirect(safeNext(next) ?? landingPathFor(user?.role ?? "owner"));
}

export async function register(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password, next } = readCredentials(formData);
  if (!email || !password) {
    return { error: "Enter your email address and password.", notice: null };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`,
      notice: null,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return { error: error.message, notice: null };
  }

  // Email confirmation is switched off for this prototype, so sign-up returns a
  // session and the new owner goes straight to their dashboard. If a project
  // has confirmation switched on there is no session yet, so say so instead.
  if (!data.session) {
    return {
      error: null,
      notice: "Account created. Confirm your email address, then sign in.",
    };
  }

  const user = await getSessionUser();
  redirect(safeNext(next) ?? landingPathFor(user?.role ?? "owner"));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
