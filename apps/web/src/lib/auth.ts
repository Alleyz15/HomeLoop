import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "admin";

export type SessionUser = {
  id: string;
  email: string | null;
  role: Role;
};

/**
 * The signed-in user plus their database role, or null when signed out.
 *
 * `profiles.role` is the source of truth for the role; the JWT does not carry
 * it, and a homeowner cannot change their own row (the B1 migration blocks it).
 * Anything missing or unrecognised falls back to `owner`, the lower privilege.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    role: data?.role === "admin" ? "admin" : "owner",
  };
}

/** Where a role lands after signing in. */
export function landingPathFor(role: Role): string {
  return role === "admin" ? "/admin" : "/dashboard";
}
