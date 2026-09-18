import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Penny</h1>
        <form action={signOut}>
          <button
            type="submit"
            className="h-9 rounded-lg border border-foreground/20 px-3 text-sm"
          >
            Sign out
          </button>
        </form>
      </header>

      <p className="text-sm text-foreground/60">
        Signed in as {data.user.email}
      </p>
    </main>
  );
}
