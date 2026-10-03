"use client";

import { useActionState } from "react";
import { inputClass } from "@/components/form-styles";
import { Wordmark } from "@/components/wordmark";
import { signIn, type AuthState } from "./actions";

const initial: AuthState = {};

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-10 px-5 py-12">
      <div className="flex flex-col gap-3">
        <Wordmark className="text-3xl" />
        <h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.04em]">
          Welcome back.
        </h1>
        <p className="text-muted">Sign in to see where your money went.</p>
      </div>

      <form action={action} className="flex flex-col gap-4">
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
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </label>

        {state.error && (
          <p role="alert" className="text-sm text-negative">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 h-13 rounded-full bg-foreground text-base font-medium text-surface transition-opacity hover:opacity-85 active:opacity-70 disabled:opacity-50"
        >
          {pending ? "One moment…" : "Sign in"}
        </button>
      </form>

      <div className="flex flex-col gap-2 text-center text-sm text-muted">
        <p>
          Just looking to demo the app? The demo email and password are in the{" "}
          <a
            href="https://github.com/celinashen/penny/blob/main/README.md#try-it"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline underline-offset-4"
          >
            README
          </a>
          .
        </p>
        <p>
          Want a real account? Reach out to{" "}
          <a
            href="mailto:celinashen2001@gmail.com"
            className="font-medium text-foreground underline underline-offset-4"
          >
            celinashen2001@gmail.com
          </a>
          .
        </p>
      </div>
    </main>
  );
}
