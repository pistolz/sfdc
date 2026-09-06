import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { GENERATORS } from "@/lib/generators";
import { getSessionUser } from "@/lib/session";
import { PLANS } from "@/lib/plans";
import { PricingGrid } from "@/components/pricing";
import { LogoMark, Wordmark } from "@/components/logo";
import { buttonClasses } from "@/components/ui/styles";

const STEPS = [
  {
    title: "Brief it once",
    body: "Fill in a brand kit: what you sell, who it is for, how you sound, the words you never use. Five minutes, once.",
  },
  {
    title: "Pick what you need",
    body: "Newsletter, landing page, ad set, social pack, blog post, outbound sequence, launch kit or a month of calendar.",
  },
  {
    title: "Ship it",
    body: "Watch it write, then copy, download or keep editing. Everything lands in your asset library with the brief attached.",
  },
];

const FAQS = [
  {
    q: "Does it actually sound like us?",
    a: "That is the whole point of the brand kit. Your voice, audience, value props, differentiators and banned words are prepended to every single generation, along with a sample of copy you have already approved. The more specific your kit, the less it reads like generic AI copy.",
  },
  {
    q: "What is a credit?",
    a: "Credits meter real usage rather than a flat per-run fee, so a three-line ad costs a fraction of a full landing page. A typical generation runs about 10 credits, which is why the Starter plan covers roughly 150 pieces a month.",
  },
  {
    q: "Can I run more than one brand?",
    a: `Yes. Free includes one brand kit, Starter three, Pro ten, and Agency unlimited — built for people running several client brands side by side.`,
  },
  {
    q: "Who owns the output?",
    a: "You do. Everything generated in your account is yours to publish, edit and sell, with no attribution required.",
  },
  {
    q: "Do I need a credit card to start?",
    a: `No. The free plan gives you ${PLANS.free.credits} credits a month and all eight generators. Add a card only when you need more volume.`,
  },
  {
    q: "Will it invent facts about my product?",
    a: "It is instructed never to fabricate statistics, customer names, testimonials, funding or press. Where a claim needs a source you have not given it, it writes around the gap or leaves a clearly marked placeholder for you to fill.",
  },
];

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-[13px] font-semibold tracking-[0.14em] text-accent-text uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {body ? <p className="mt-4 text-[15px] text-muted">{body}</p> : null}
    </div>
  );
}

function HeroPreview() {
  const sample = [
    { w: "w-[92%]" },
    { w: "w-[78%]" },
    { w: "w-[85%]" },
    { w: "w-[60%]" },
  ];
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft"
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5">
        <LogoMark className="size-4 text-accent" />
        <span className="text-[13px] font-medium text-muted">
          Studio · Email newsletter
        </span>
        <span className="ml-auto rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-faint tabular-nums">
          1,482 credits
        </span>
      </div>
      <div className="grid gap-px bg-border sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="space-y-3 bg-surface p-4">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
            Brief
          </p>
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-muted">
            Northwind Analytics
          </div>
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-muted">
            We shipped scheduled reports. Tie it to the month-end crunch.
          </div>
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-muted">
            Goal · Drive clicks to a page
          </div>
          <div className="h-9 rounded-lg bg-accent" />
        </div>
        <div className="space-y-2.5 bg-surface p-4">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
            Output
          </p>
          <p className="text-sm font-semibold">
            Month-end shouldn&rsquo;t cost you a weekend
          </p>
          {sample.map((line, index) => (
            <div
              key={index}
              className={`h-2.5 rounded-full bg-surface-3 ${line.w}`}
            />
          ))}
          <div className="h-2.5 w-[70%] rounded-full bg-surface-3" />
          <div className="flex items-center gap-1.5 pt-1">
            <div className="h-2.5 w-[34%] rounded-full bg-surface-3" />
            <span className="inline-block h-3.5 w-[2px] animate-caret bg-accent" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const user = await getSessionUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <Wordmark />
          <nav
            aria-label="Primary"
            className="hidden items-center gap-6 text-sm text-muted md:flex"
          >
            <a href="#generators" className="rounded hover:text-fg">
              Generators
            </a>
            <a href="#how" className="rounded hover:text-fg">
              How it works
            </a>
            <a href="#pricing" className="rounded hover:text-fg">
              Pricing
            </a>
            <a href="#faq" className="rounded hover:text-fg">
              FAQ
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Link href="/app" className={buttonClasses("primary", "sm")}>
                Open studio
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={buttonClasses("ghost", "sm", "hidden sm:inline-flex")}
                >
                  Sign in
                </Link>
                <Link href="/login" className={buttonClasses("primary", "sm")}>
                  Start free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {/* Hero ------------------------------------------------------------ */}
        <section className="relative overflow-hidden border-b border-border">
          <div
            aria-hidden="true"
            className="cl-grid-bg pointer-events-none absolute inset-0"
          />
          <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-16 sm:pt-24 sm:pb-24">
            <div className="mx-auto max-w-3xl text-center">
              <p className="inline-flex items-center gap-2 rounded-full border border-accent-soft-border bg-accent-soft px-3 py-1 text-[12px] font-medium text-accent-text">
                Eight generators · one brand voice
              </p>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
                {BRAND.tagline}
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-muted">
                {BRAND.description}
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href={user ? "/app" : "/login"}
                  className={buttonClasses("primary", "lg", "w-full sm:w-auto")}
                >
                  {user ? "Open studio" : "Start free"}
                </Link>
                <a
                  href="#generators"
                  className={buttonClasses("secondary", "lg", "w-full sm:w-auto")}
                >
                  See what it writes
                </a>
              </div>
              <p className="mt-4 text-[13px] text-faint">
                {PLANS.free.credits} credits a month on the free plan. No card
                required.
              </p>
            </div>

            <div className="mx-auto mt-14 max-w-4xl">
              <HeroPreview />
            </div>
          </div>
        </section>

        {/* Generators ------------------------------------------------------ */}
        <section id="generators" className="border-b border-border py-20">
          <div className="mx-auto max-w-6xl px-5">
            <SectionHeading
              eyebrow="The team"
              title="Eight specialists, not one chat box"
              body="Each generator has its own brief, its own structure and its own output format — because a cold email and a landing page are not the same job."
            />
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {GENERATORS.map((generator) => (
                <li
                  key={generator.id}
                  className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong"
                >
                  <span aria-hidden="true" className="text-xl">
                    {generator.icon}
                  </span>
                  <h3 className="mt-3 text-[15px] font-semibold tracking-tight">
                    {generator.name}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                    {generator.blurb}
                  </p>
                  <p className="mt-3 text-[11px] font-medium tracking-[0.1em] text-faint uppercase">
                    {generator.category}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works ---------------------------------------------------- */}
        <section id="how" className="border-b border-border py-20">
          <div className="mx-auto max-w-6xl px-5">
            <SectionHeading
              eyebrow="How it works"
              title="From blank page to shipped in three steps"
            />
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="rounded-xl border border-border bg-surface p-6"
                >
                  <span className="inline-flex size-8 items-center justify-center rounded-lg border border-accent-soft-border bg-accent-soft text-sm font-semibold text-accent-text tabular-nums">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-[17px] font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Brand kit ------------------------------------------------------- */}
        <section className="border-b border-border py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
            <div>
              <p className="text-[13px] font-semibold tracking-[0.14em] text-accent-text uppercase">
                Brand kits
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Brief once. Everything sounds like you.
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed text-muted">
                Generic AI copy is a briefing problem, not a model problem. A
                brand kit captures the things you would tell a new copywriter on
                day one — and then every generation starts from that page
                instead of from nothing.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-muted">
                {[
                  "Voice and tone, in your words — plain, warm, technical, blunt.",
                  "Audience, value props and the differentiators you actually win on.",
                  "A banned-words list, so “leverage” and “seamless” never appear again.",
                  "A sample of copy you have already approved, used as the reference.",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-accent"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={user ? "/app/brand" : "/login"}
                className={buttonClasses("secondary", "md", "mt-8")}
              >
                Build your brand kit
              </Link>
            </div>

            <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
                Brand kit
              </p>
              <dl className="mt-4 space-y-4 text-sm">
                {[
                  ["One-liner", "Scheduled reporting for finance teams who close the books every month."],
                  ["Audience", "Controllers and FP&A leads at 50–500 person companies."],
                  ["Tone", "Plain, specific, a little dry. No hype, no exclamation marks."],
                  ["Never say", "leverage, seamless, revolutionary, game-changing"],
                ].map(([term, value]) => (
                  <div
                    key={term}
                    className="border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    <dt className="text-[12px] font-medium tracking-wide text-faint uppercase">
                      {term}
                    </dt>
                    <dd className="mt-1 leading-relaxed text-muted">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Pricing --------------------------------------------------------- */}
        <section id="pricing" className="border-b border-border py-20">
          <div className="mx-auto max-w-6xl px-5">
            <SectionHeading
              eyebrow="Pricing"
              title="Pay for output, not seats"
              body="Every plan includes all eight generators and the full asset library. Change or cancel whenever you like."
            />
            <div className="mt-12">
              <PricingGrid
                renderAction={(plan) => (
                  <Link
                    href="/login"
                    className={buttonClasses(
                      plan.highlight ? "primary" : "secondary",
                      "md",
                      "w-full",
                    )}
                  >
                    {plan.price === 0 ? "Start free" : `Choose ${plan.name}`}
                  </Link>
                )}
              />
            </div>
          </div>
        </section>

        {/* FAQ ------------------------------------------------------------- */}
        <section id="faq" className="border-b border-border py-20">
          <div className="mx-auto max-w-3xl px-5">
            <SectionHeading eyebrow="FAQ" title="Questions, answered" />
            <div className="mt-10 divide-y divide-border rounded-xl border border-border bg-surface">
              {FAQS.map((faq) => (
                <details key={faq.q} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium">
                    {faq.q}
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-faint transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA ----------------------------------------------------- */}
        <section className="py-20">
          <div className="mx-auto max-w-3xl px-5 text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Your next campaign is a five-minute brief away
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] text-muted">
              Set up your brand kit, then let {BRAND.name} draft the newsletter,
              the landing page and the ads while you review.
            </p>
            <Link
              href={user ? "/app" : "/login"}
              className={buttonClasses("primary", "lg", "mt-8")}
            >
              {user ? "Open studio" : "Start free"}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface-2">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Wordmark />
            <p className="mt-2 max-w-sm text-[13px] text-faint">
              {BRAND.tagline}
            </p>
          </div>
          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-muted"
          >
            <a href="#pricing" className="rounded hover:text-fg">
              Pricing
            </a>
            <a href="#faq" className="rounded hover:text-fg">
              FAQ
            </a>
            <Link href="/login" className="rounded hover:text-fg">
              Sign in
            </Link>
            <a
              href={`mailto:${BRAND.supportEmail}`}
              className="rounded hover:text-fg"
            >
              {BRAND.supportEmail}
            </a>
          </nav>
        </div>
        <div className="border-t border-border">
          <p className="mx-auto max-w-6xl px-5 py-5 text-[12px] text-faint">
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
