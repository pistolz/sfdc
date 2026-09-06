import "server-only";
import { NextResponse } from "next/server";
import { UnauthorizedError, requireUser, type SessionUser } from "./session";
import { ensureUserRecord } from "./firestore";
import type { UserRecord } from "./types";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Wraps a route handler with authentication and uniform error handling.
 *
 * The handler receives the verified session user and their account record, so
 * no handler ever has to trust a uid supplied by the client.
 */
export function withAuth<T>(
  handler: (ctx: {
    user: SessionUser;
    account: UserRecord;
  }) => Promise<NextResponse<T> | Response>,
) {
  return async (): Promise<Response> => {
    try {
      const user = await requireUser();
      const account = await ensureUserRecord(user);
      return await handler({ user, account });
    } catch (error) {
      return handleRouteError(error);
    }
  };
}

export function handleRouteError(error: unknown): Response {
  if (error instanceof UnauthorizedError) {
    return jsonError("Please sign in.", 401);
  }
  console.error("[api]", error);
  const message =
    error instanceof Error ? error.message : "Something went wrong.";
  // Configuration problems are worth surfacing; anything else stays generic.
  const isConfig = message.startsWith("Missing required environment variable");
  return jsonError(
    isConfig ? message : "Something went wrong. Please try again.",
    500,
  );
}

/** Parses a JSON body, returning null when it is absent or malformed. */
export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
