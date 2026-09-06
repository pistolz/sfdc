import { NextResponse } from "next/server";
import { handleRouteError, jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { deleteBrand, getBrand, updateBrand } from "@/lib/firestore";
import { parseBrandInput } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const brand = await getBrand(user.uid, id);
    if (!brand) return jsonError("Brand kit not found.", 404);
    return NextResponse.json({ brand });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const parsed = parseBrandInput(await readJson(request));
    if (!parsed.ok) return jsonError(parsed.error, 400);

    // Scoped to the caller's own subcollection, so a guessed id from another
    // account simply does not resolve.
    const brand = await updateBrand(user.uid, id, parsed.value);
    if (!brand) return jsonError("Brand kit not found.", 404);
    return NextResponse.json({ brand });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await deleteBrand(user.uid, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
