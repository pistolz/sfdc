import "server-only";
import { cookies } from "next/headers";
import { adminAuth } from "./firebase-admin";

export const SESSION_COOKIE = "cl_session";

/** Five days, matching the maximum Firebase session cookie lifetime we want. */
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  uid: string;
  email: string;
  displayName: string;
}

/**
 * Exchange a Firebase ID token (produced in the browser) for a server-side
 * session cookie.
 *
 * The cookie is httpOnly, so the browser JS bundle can never read it, and
 * `verifySessionCookie(..., true)` below checks revocation on every request —
 * signing out or disabling an account takes effect immediately rather than
 * whenever the token happens to expire.
 */
export async function createSession(idToken: string): Promise<void> {
  const auth = adminAuth();
  // Verify before minting so a forged token cannot become a valid session.
  await auth.verifyIdToken(idToken, true);
  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Returns the signed-in user, or null. Never throws on a bad cookie. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? "",
      displayName: (decoded.name as string | undefined) ?? "",
    };
  } catch {
    // Expired, revoked or tampered-with cookie — treat as signed out.
    return null;
  }
}

/** Thrown by requireUser and converted to a 401 by the API route helper. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthorizedError";
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
