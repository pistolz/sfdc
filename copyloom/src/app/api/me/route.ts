import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { listBrands, toAccountView } from "@/lib/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAuth(async ({ user, account }) => {
  const brands = await listBrands(user.uid);
  return NextResponse.json({ account: toAccountView(account), brands });
});
