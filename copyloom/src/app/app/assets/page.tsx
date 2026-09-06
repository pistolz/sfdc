import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { countAssets, listAssets } from "@/lib/firestore";
import { PageHeader } from "@/components/page-header";
import { AssetsClient } from "@/components/assets-client";
import { buttonClasses } from "@/components/ui/styles";
import { formatNumber, pluralise } from "@/components/format";

export const metadata: Metadata = { title: "Assets" };

const PAGE_SIZE = 30;

export default async function AssetsPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const [assets, total] = await Promise.all([
    listAssets(user.uid, { limit: PAGE_SIZE }),
    countAssets(user.uid),
  ]);

  return (
    <>
      <PageHeader
        title="Assets"
        description={
          total > 0
            ? `${formatNumber(total)} ${pluralise(total, "piece")} of content, newest first.`
            : "Everything you generate is saved here."
        }
        actions={
          <Link href="/app" className={buttonClasses("primary", "md")}>
            New generation
          </Link>
        }
      />
      <div className="px-5 py-6 lg:px-8">
        <AssetsClient initialAssets={assets} pageSize={PAGE_SIZE} />
      </div>
    </>
  );
}
