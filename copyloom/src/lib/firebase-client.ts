"use client";

import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
  type Auth,
} from "firebase/auth";

/**
 * Browser-side Firebase, initialised from config handed down by the server at
 * runtime rather than inlined at build time. That is what lets one container
 * image be promoted across environments without a rebuild.
 */
let auth: Auth | null = null;

export function initFirebase(config: FirebaseOptions): Auth {
  if (auth) return auth;
  const app = getApps().length ? getApps()[0] : initializeApp(config);
  auth = getAuth(app);
  // Session state lives in the httpOnly cookie; local persistence just avoids a
  // re-login flash while the ID token is exchanged.
  void setPersistence(auth, browserLocalPersistence);
  return auth;
}

export function firebaseAuth(): Auth {
  if (!auth) throw new Error("Firebase has not been initialised yet.");
  return auth;
}
