import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import {
  countAssets,
  ensureUserRecord,
  listAssets,
  listBrands,
  toAccountView,
} from "@/lib/firestore";
import { GENERATORS, getGenerator } from "@/lib/generators";
import { estimateCredits } from "@/lib/credits";
import { PageHeader } from "@/components/page-header";
import { CreditSummary } from "@/components/credit-meter";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/styles";
import { formatDate, formatNumber, pluralise } from "@/components/format";
import type { Generator } from "@/lib/generators";

export const metadata: Metadata = { title: "Dashboard" };

function groupByCategory(generators: Generator[]): Array<[string, Generator[]]> {
  const groups = new Map<string, Generator[]>();
  for (const generator of generators) {
    const bucket = groups.get(generator.category) ?? [];
    bucket.push(generator);
    groups.set(generator.category, bucket);
  }
  return [...groups.entries()];
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  // The layout guarantees a session; this narrows the type for TypeScript.
  if (!user) return null;

  const [record, brands, assets, assetCount] = await Promise.all([
    ensureUserRecord(user),
    listBrands(user.uid),
    listAssets(user.uid, { limit: 6 }),
    countAssets(user.uid),
  ]);
  const account = toAccountView(record);
  const firstName = (account.displayName || "").split(" ")[0];
  const groups = groupByCategory(GENERATORS);

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Studio"}
        description="Pick a generator, brief it, and it writes against your brand kit."
        actions={
          <Link
            href="/app/assets"
            className={buttonClasses("secondary", "md")}
          >
            {assetCount > 0
              ? `${formatNumber(assetCount)} ${pluralise(assetCount, "asset")}`
              : "Asset library"}
          </Link>
        }
      />

      <div className="space-y-10 px-5 py-8 lg:px-8">
        <section aria-labelledby="usage-heading">
          <h2 id="usage-heading" className="sr-only">
            Credit usage
          </h2>
          <CreditSummary account={account} />
          {account.credits <= 0 ? (
            <Alert
              tone="warning"
              className="mt-4"
              title="You are out of credits"
              action={
                <Link href="/app/billing" className={buttonClasses("primary", "sm")}>
                  Upgrade
                </Link>
              }
            >
              Credits refill on {formatDate(account.periodEnd)}. Upgrade to keep
              generating before then.
            </Alert>
          ) : null}
        </section>

        {brands.length === 0 ? (
          <section aria-labelledby="brand-heading">
            <h2 id="brand-heading" className="sr-only">
              Brand kit setup
            </h2>
            <EmptyState
              icon="◈"
              title="Set up your brand kit first"
              description="Five minutes here is the difference between copy that sounds like you and copy that sounds like everyone else. Your kit is prepended to every generation."
              action={
                <Link href="/app/brand" className={buttonClasses("primary", "md")}>
                  Create a brand kit
                </Link>
              }
            />
          </section>
        ) : null}

        <section aria-labelledby="generators-heading" className="space-y-8">
          <div>
            <h2
              id="generators-heading"
              className="text-lg font-semibold tracking-tight"
            >
              Generators
            </h2>
            <p className="mt-1 text-sm text-muted">
              Estimated cost is shown per run; you are only charged for what the
              model actually produces.
            </p>
          </div>

          {groups.map(([category, items]) => (
            <div key={category}>
              <h3 className="mb-3 text-[12px] font-semibold tracking-[0.12em] text-faint uppercase">
                {category}
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((generator) => (
                  <li key={generator.id}>
                    <Link
                      href={`/app/studio/${generator.id}`}
                      className="group flex h-full flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong hover:bg-surface-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span aria-hidden="true" className="text-xl">
                          {generator.icon}
                        </span>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-faint tabular-nums">
                          ~{estimateCredits(generator.maxTokens)} cr
                        </span>
                      </div>
                      <h4 className="mt-3 text-[15px] font-semibold tracking-tight group-hover:text-accent-text">
                        {generator.name}
                      </h4>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                        {generator.blurb}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section aria-labelledby="recent-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="recent-heading" className="text-lg font-semibold tracking-tight">
              Recent work
            </h2>
            {assets.length > 0 ? (
              <Link
                href="/app/assets"
                className="rounded text-[13px] text-accent-text underline underline-offset-4 hover:opacity-80"
              >
                View all
              </Link>
            ) : null}
          </div>

          {assets.length === 0 ? (
            <EmptyState
              icon="✳"
              title="Nothing generated yet"
              description="Everything you create is saved here with the brief that produced it, so you can rerun or reuse it later."
              action={
                <Link
                  href="/app/studio/newsletter"
                  className={buttonClasses("primary", "md")}
                >
                  Write a newsletter
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {assets.map((asset) => {
                const generator = getGenerator(asset.generatorId);
                return (
                  <li key={asset.id}>
                    <Link
                      href={`/app/assets/${asset.id}`}
                      className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2"
                    >
                      <span aria-hidden="true" className="text-lg">
                        {generator?.icon ?? "◆"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {asset.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[13px] text-faint">
                          {generator?.name ?? asset.generatorId} ·{" "}
                          {formatDate(asset.createdAt)}
                        </span>
                      </span>
                      <span className="shrink-0 text-[13px] text-faint tabular-nums">
                        {formatNumber(asset.creditsUsed)} cr
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
