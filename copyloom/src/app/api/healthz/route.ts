import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness probe for Cloud Run. Deliberately does no I/O. */
export function GET() {
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
