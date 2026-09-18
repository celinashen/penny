import { createClient } from "@/lib/supabase/server";

/** The signed-in user, or null. For route handlers. */
export async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
