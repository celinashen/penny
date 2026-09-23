import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user, or null. For route handlers. */
export async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/**
 * The one account anyone can sign into to try the app, if `DEMO_ACCOUNT_EMAIL`
 * is set. It behaves like any other account except that linking a real bank
 * is blocked before Plaid is ever called, so a stranger playing with it can
 * never spend one of the limited production Items.
 */
export function isDemoUser(user: Pick<User, "email"> | null | undefined): boolean {
  const demoEmail = process.env.DEMO_ACCOUNT_EMAIL?.trim().toLowerCase();
  if (!demoEmail || !user?.email) return false;
  return user.email.trim().toLowerCase() === demoEmail;
}

export const DEMO_BLOCKED_MESSAGE =
  "This demo account is available to the public — we’ve blocked connecting your bank account.";
