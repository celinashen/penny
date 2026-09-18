"use client";

import { useActionState, useState } from "react";
import { Wordmark } from "@/components/wordmark";
import { signIn, signUp, type AuthState } from "./actions";

const initial: AuthState = {};

const inputClass =
  "h-13 rounded-xl border border-line bg-surface px-4 text-base text-foreground outline-none transition-shadow placeholder:text-muted/60 focus:border-foreground focus:ring-4 focus:ring-foreground/10";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signInAction, signInPending] = useActionState(
    signIn,
    initial,
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUp,
    initial,
  );

  const isSignIn = mode === "signin";
  const state = isSignIn ? signInState : signUpState;
  const pending = isSignIn ? signInPending : signUpPending;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-10 px-5 py-12">
      <div className="flex flex-col gap-3">
        <Wordmark className="text-3xl" />
        <h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.04em]">
          {isSignIn ? "Welcome back." : "Create your account."}
        </h1>
        <p className="text-muted">
          {isSignIn
            ? "Sign in to see where your money went."
            : "Track every card and account in one place."}
        </p>
      </div>

      <form
        // Remount on mode change so each form starts clean.
        key={mode}
        action={isSignIn ? signInAction : signUpAction}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-2 text-sm font-medium">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Password
          <input
            name="password"
            type="password"
            autoComplete={isSignIn ? "current-password" : "new-password"}
            minLength={isSignIn ? undefined : 8}
            required
            className={inputClass}
          />
        </label>

        {state.error && (
          <p role="alert" className="text-sm text-negative">
            {state.error}
          </p>
        )}
        {state.message && (
          <p role="status" className="text-sm text-positive">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 h-13 rounded-full bg-foreground text-base font-medium text-surface transition-opacity hover:opacity-85 active:opacity-70 disabled:opacity-50"
        >
          {pending ? "One moment…" : isSignIn ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(isSignIn ? "signup" : "signin")}
        className="text-center text-sm text-muted transition-colors hover:text-foreground"
      >
        {isSignIn ? (
          <>
            New here?{" "}
            <span className="font-medium text-foreground underline underline-offset-4">
              Create an account
            </span>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <span className="font-medium text-foreground underline underline-offset-4">
              Sign in
            </span>
          </>
        )}
      </button>
    </main>
  );
}
