import type { Metadata } from "next";
import { getSessionUser } from "@/lib/session";
import { ensureUserRecord, listBrands, toAccountView } from "@/lib/firestore";
import { BRAND_LIMIT, planFor } from "@/lib/plans";
import { PageHeader } from "@/components/page-header";
import { BrandManager } from "@/components/brand-manager";

export const metadata: Metadata = { title: "Brand kits" };

export default async function BrandPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const [record, brands] = await Promise.all([
    ensureUserRecord(user),
    listBrands(user.uid),
  ]);
  const account = toAccountView(record);
  const plan = planFor(account.plan);

  return (
    <>
      <PageHeader
        title="Brand kits"
        description="Brief it once. Every generation starts from your voice, your audience and the words you refuse to use."
      />
      <div className="px-5 py-6 lg:px-8">
        <BrandManager
          initialBrands={brands}
          limit={BRAND_LIMIT[plan.id]}
          planName={plan.name}
        />
      </div>
    </>
  );
}
