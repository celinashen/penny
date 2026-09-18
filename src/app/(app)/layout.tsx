import { redirect } from "next/navigation";
import { SidebarNav, TabBar } from "@/components/app-nav";
import { Wordmark } from "@/components/wordmark";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";

function SignOutButton({ className = "" }: { className?: string }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={`rounded-full border border-line bg-surface px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-raised ${className}`}
      >
        Sign out
      </button>
    </form>
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16.5rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col justify-between border-r border-line bg-surface px-4 py-7 lg:flex">
        <div className="flex flex-col gap-9">
          <Wordmark className="px-3 text-2xl" />
          <SidebarNav />
        </div>
        <div className="flex flex-col gap-3 px-3">
          <p className="truncate text-sm text-muted" title={data.user.email}>
            {data.user.email}
          </p>
          <SignOutButton className="self-start" />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex items-center justify-between bg-background/80 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl lg:hidden">
          <Wordmark className="text-xl" />
          <SignOutButton />
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-32 lg:px-10 lg:py-12">
          {children}
        </main>
      </div>

      <TabBar />
    </div>
  );
}
