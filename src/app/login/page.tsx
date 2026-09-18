"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";

const initial: AuthState = {};

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
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Penny</h1>
        <p className="mt-1 text-sm text-foreground/60">
          {isSignIn ? "Sign in to your budget." : "Create your account."}
        </p>
      </div>

      <form
        // Remount on mode change so each form starts clean.
        key={mode}
        action={isSignIn ? signInAction : signUpAction}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="h-11 rounded-lg border border-foreground/20 bg-transparent px-3 text-base outline-none focus:border-foreground"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Password
          <input
            name="password"
            type="password"
            autoComplete={isSignIn ? "current-password" : "new-password"}
            minLength={isSignIn ? undefined : 8}
            required
            className="h-11 rounded-lg border border-foreground/20 bg-transparent px-3 text-base outline-none focus:border-foreground"
          />
        </label>

        {state.error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
        {state.message && (
          <p role="status" className="text-sm text-green-700 dark:text-green-400">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-lg bg-foreground text-base font-medium text-background transition-opacity disabled:opacity-60"
        >
          {pending ? "Please wait…" : isSignIn ? "Sign in" : "Sign up"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(isSignIn ? "signup" : "signin")}
        className="text-sm text-foreground/60 underline underline-offset-4"
      >
        {isSignIn
          ? "No account yet? Sign up"
          : "Already have an account? Sign in"}
      </button>
    </main>
  );
}
