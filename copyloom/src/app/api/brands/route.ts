import { NextResponse } from "next/server";
import { handleRouteError, jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { createBrand, ensureUserRecord, listBrands } from "@/lib/firestore";
import { parseBrandInput } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ brands: await listBrands(user.uid) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const account = await ensureUserRecord(user);

    const parsed = parseBrandInput(await readJson(request));
    if (!parsed.ok) return jsonError(parsed.error, 400);

    // Plan limits are enforced server-side inside createBrand.
    const result = await createBrand(user.uid, account.plan, parsed.value);
    if (!result.ok) return jsonError(result.error, 400);

    return NextResponse.json({ brand: result.brand }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
