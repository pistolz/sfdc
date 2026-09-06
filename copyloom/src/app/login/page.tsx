import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { firebasePublicConfig } from "@/lib/env";
import { getSessionUser } from "@/lib/session";
import { PLANS } from "@/lib/plans";
import { AuthForm } from "@/components/auth-form";
import { LogoMark, Wordmark } from "@/components/logo";

export const metadata: Metadata = {
  title: "Sign in",
  description: `Sign in to ${BRAND.name}.`,
  robots: { index: false, follow: false },
};

// Firebase config is read from the environment per request, never inlined at
// build time, so one image can be promoted across environments.
export const dynamic = "force-dynamic";

const PROOF = [
  "Newsletters, landing pages, ads, social, blog posts, outbound, launch kits and calendars.",
  "Every draft written against your brand kit, not a generic prompt.",
  "Credits meter real usage, so short pieces cost less.",
];

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/app");

  const config = firebasePublicConfig();

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      {/* Form ------------------------------------------------------------- */}
      <main
        id="main"
        className="flex flex-col justify-center px-5 py-12 sm:px-10"
      >
        <div className="mx-auto w-full max-w-sm">
          <Wordmark className="mb-10" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to {BRAND.name}
          </h1>
          <p className="mt-2 mb-8 text-sm text-muted">
            Sign in, or create an account and get {PLANS.free.credits} free
            credits a month.
          </p>

          <AuthForm config={config} />

          <p className="mt-10 text-center text-[13px] text-faint">
            <Link href="/" className="rounded hover:text-fg">
              ← Back to {BRAND.name}
            </Link>
          </p>
        </div>
      </main>

      {/* Side panel ------------------------------------------------------- */}
      <aside className="relative hidden flex-col justify-between border-l border-border bg-surface-2 p-10 lg:flex">
        <div
          aria-hidden="true"
          className="cl-grid-bg pointer-events-none absolute inset-0 opacity-70"
        />
        <div className="relative">
          <LogoMark className="size-7 text-accent" />
        </div>
        <div className="relative max-w-md">
          <p className="text-3xl font-semibold tracking-tight">
            {BRAND.tagline}
          </p>
          <ul className="mt-8 space-y-4 text-sm text-muted">
            {PROOF.map((line) => (
              <li key={line} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-accent"
                />
                <span className="leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[13px] text-faint">
          Questions? {BRAND.supportEmail}
        </p>
      </aside>
    </div>
  );
}
