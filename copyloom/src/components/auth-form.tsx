"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type User,
} from "firebase/auth";
import { initFirebase } from "@/lib/firebase-client";
import { Button } from "./ui/button";
import { Field, Input } from "./ui/field";
import { Alert } from "./ui/alert";
import { cn } from "./ui/styles";

export interface FirebasePublicConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
}

type Mode = "signin" | "signup";

/** Firebase error codes surface as strings; translate the ones users can hit. */
const ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "That email and password combination is not right.",
  "auth/invalid-email": "That does not look like a valid email address.",
  "auth/user-disabled": "This account has been disabled. Contact support.",
  "auth/user-not-found": "No account found for that email.",
  "auth/wrong-password": "That password is not right.",
  "auth/email-already-in-use":
    "There is already an account with that email. Try signing in instead.",
  "auth/weak-password": "Passwords need to be at least 6 characters.",
  "auth/missing-password": "Enter a password to continue.",
  "auth/popup-closed-by-user": "The Google window closed before sign-in finished.",
  "auth/cancelled-popup-request": "The Google window closed before sign-in finished.",
  "auth/popup-blocked":
    "Your browser blocked the Google popup. Allow popups and try again.",
  "auth/unauthorized-domain":
    "This domain is not authorised for sign-in. Add it in Firebase Authentication settings.",
  "auth/too-many-requests":
    "Too many attempts. Wait a minute and try again, or reset your password.",
  "auth/network-request-failed":
    "Could not reach the authentication service. Check your connection.",
  "auth/operation-not-allowed":
    "That sign-in method is not enabled for this project.",
};

function messageFor(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String((error as { code: unknown }).code);
    if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

export function AuthForm({ config }: { config: FirebasePublicConfig }) {
  const router = useRouter();
  const ids = useId();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "email" | "google">(null);

  useEffect(() => {
    initFirebase(config);
  }, [config]);

  async function establishSession(user: User) {
    const idToken = await user.getIdToken();
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(payload.error ?? "Could not start your session.");
    }
    router.push("/app");
    router.refresh();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy("email");
    try {
      const auth = initFirebase(config);
      if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );
        const displayName = name.trim();
        if (displayName) {
          await updateProfile(credential.user, { displayName });
          // Refresh so the session cookie carries the name we just set.
          await credential.user.getIdToken(true);
        }
        await establishSession(credential.user);
      } else {
        const credential = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );
        await establishSession(credential.user);
      }
    } catch (caught) {
      setError(messageFor(caught));
      setBusy(null);
    }
  }

  async function onGoogle() {
    setError(null);
    setBusy("google");
    try {
      const auth = initFirebase(config);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(auth, provider);
      await establishSession(credential.user);
    } catch (caught) {
      setError(messageFor(caught));
      setBusy(null);
    }
  }

  const isSignup = mode === "signup";

  return (
    <div className="w-full">
      <div
        role="tablist"
        aria-label="Authentication mode"
        className="mb-6 inline-flex w-full rounded-lg border border-border bg-surface-2 p-0.5"
      >
        {(["signin", "signup"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => {
              setMode(value);
              setError(null);
            }}
            className={cn(
              "flex-1 rounded-[6px] px-3 py-1.5 text-sm font-medium transition-colors",
              mode === value
                ? "bg-surface text-fg shadow-xs"
                : "text-muted hover:text-fg",
            )}
          >
            {value === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      {error ? (
        <Alert tone="danger" className="mb-5">
          {error}
        </Alert>
      ) : (
        <div aria-live="assertive" className="sr-only" />
      )}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {isSignup ? (
          <Field id={`${ids}-name`} label="Your name">
            <Input
              id={`${ids}-name`}
              name="name"
              autoComplete="name"
              placeholder="Alex Rivera"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
        ) : null}

        <Field id={`${ids}-email`} label="Work email" required>
          <Input
            id={`${ids}-email`}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field
          id={`${ids}-password`}
          label="Password"
          required
          help={isSignup ? "At least 6 characters." : undefined}
        >
          <Input
            id={`${ids}-password`}
            name="password"
            type="password"
            required
            minLength={isSignup ? 6 : undefined}
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={busy === "email"}
          disabled={busy !== null}
        >
          {isSignup ? "Create account" : "Sign in"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-[12px] text-faint">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        onClick={onGoogle}
        loading={busy === "google"}
        disabled={busy !== null}
      >
        <svg aria-hidden="true" viewBox="0 0 18 18" className="size-4">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
          />
          <path
            fill="#FBBC05"
            d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
          />
        </svg>
        Continue with Google
      </Button>

      <p className="mt-6 text-center text-[13px] text-faint">
        {isSignup
          ? "By creating an account you agree to fair use of the service."
          : "Trouble signing in? Try creating an account instead."}
      </p>
    </div>
  );
}
