/**
 * Form state shared by the auth actions and the client form.
 *
 * This lives outside `actions.ts` because a `"use server"` module may only
 * export async functions.
 */
export type AuthState = { error: string | null; notice: string | null };

export const emptyAuthState: AuthState = { error: null, notice: null };
