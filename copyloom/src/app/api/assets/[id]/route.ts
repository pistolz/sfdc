import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { deleteAsset, getAsset } from "@/lib/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const asset = await getAsset(user.uid, id);
    if (!asset) return jsonError("Asset not found.", 404);
    return NextResponse.json({ asset });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await deleteAsset(user.uid, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
