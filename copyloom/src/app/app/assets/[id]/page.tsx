import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getAsset } from "@/lib/firestore";
import { getGenerator } from "@/lib/generators";
import { PageHeader } from "@/components/page-header";
import { ContentView } from "@/components/content-view";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/styles";
import { formatDateTime, formatNumber } from "@/components/format";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const user = await getSessionUser();
  if (!user) return { title: "Asset" };
  const { id } = await params;
  const asset = await getAsset(user.uid, id);
  return { title: asset?.title ?? "Asset" };
}

export default async function AssetDetailPage({ params }: RouteParams) {
  const user = await getSessionUser();
  if (!user) return null;

  const { id } = await params;
  const asset = await getAsset(user.uid, id);
  if (!asset) notFound();

  const generator = getGenerator(asset.generatorId);
  const fieldLabel = (name: string) =>
    generator?.fields.find((field) => field.name === name)?.label ?? name;
  const inputs = Object.entries(asset.inputs).filter(([, value]) =>
    Boolean(value?.trim()),
  );

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href="/app/assets" className="rounded hover:text-fg">
            ← Assets
          </Link>
        }
        title={asset.title}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span aria-hidden="true">{generator?.icon ?? "◆"}</span>
            <span>{generator?.name ?? asset.generatorId}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDateTime(asset.createdAt)}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {formatNumber(asset.creditsUsed)} credits
            </span>
          </span>
        }
        actions={
          generator ? (
            <Link
              href={`/app/studio/${generator.id}`}
              className={buttonClasses("secondary", "md")}
            >
              Generate another
            </Link>
          ) : null
        }
      />

      <div className="grid gap-6 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-8">
        <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface">
          <ContentView
            content={asset.content}
            format={asset.format}
            title={asset.title}
          />
        </div>

        <aside className="min-w-0 space-y-4">
          <Card>
            <CardHeader
              title="The brief"
              description="What produced this draft."
            />
            <CardBody>
              {inputs.length ? (
                <dl className="space-y-4">
                  {inputs.map(([name, value]) => (
                    <div
                      key={name}
                      className="border-b border-border pb-4 last:border-0 last:pb-0"
                    >
                      <dt className="text-[12px] font-medium tracking-wide text-faint uppercase">
                        {fieldLabel(name)}
                      </dt>
                      <dd className="mt-1 text-[13px] leading-relaxed whitespace-pre-line text-muted">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-[13px] text-faint">
                  No brief was recorded for this asset.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Details" />
            <CardBody>
            <dl className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-faint">Format</dt>
                <dd>
                  <Badge>{asset.format}</Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-faint">Brand kit</dt>
                <dd className="text-muted">
                  {asset.brandId ? (
                    <Link
                      href="/app/brand"
                      className="rounded underline underline-offset-2 hover:text-fg"
                    >
                      Applied
                    </Link>
                  ) : (
                    "None"
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-faint">Credits</dt>
                <dd className="text-muted tabular-nums">
                  {formatNumber(asset.creditsUsed)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-faint">Created</dt>
                <dd className="text-muted">{formatDateTime(asset.createdAt)}</dd>
              </div>
            </dl>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
