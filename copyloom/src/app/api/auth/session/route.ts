import { NextResponse } from "next/server";
import { createSession, destroySession } from "@/lib/session";
import { handleRouteError, jsonError, readJson } from "@/lib/api";

export const runtime = "nodejs";

/** Exchanges a Firebase ID token for an httpOnly session cookie. */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const idToken =
      typeof body === "object" && body !== null
        ? (body as { idToken?: unknown }).idToken
        : undefined;

    if (typeof idToken !== "string" || !idToken) {
      return jsonError("An ID token is required.", 400);
    }

    await createSession(idToken);
    return NextResponse.json({ ok: true });
  } catch (error) {
    // A rejected token is a client problem, not a server fault.
    if (error instanceof Error && error.message.includes("token")) {
      return jsonError("That sign-in could not be verified. Please try again.", 401);
    }
    return handleRouteError(error);
  }
}

export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
