import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { listAssets } from "@/lib/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);

    const limit = Number(url.searchParams.get("limit") ?? "30");
    const before = Number(url.searchParams.get("before") ?? "");

    const assets = await listAssets(user.uid, {
      limit: Number.isFinite(limit) ? limit : 30,
      before: Number.isFinite(before) && before > 0 ? before : undefined,
    });
    return NextResponse.json({ assets });
  } catch (error) {
    return handleRouteError(error);
  }
}
