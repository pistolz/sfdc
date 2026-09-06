import { cert, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { gcpProjectId } from "./env";

/**
 * Firebase Admin, initialised once per container.
 *
 * On Cloud Run this authenticates with the service account attached to the
 * revision via Application Default Credentials, so there is no service account
 * key file to manage or leak. Locally it picks up
 * `gcloud auth application-default login`.
 */
function adminApp() {
  const existing = getApps();
  if (existing.length) return existing[0];

  // FIREBASE_SERVICE_ACCOUNT is only for environments where ADC is unavailable.
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    return initializeApp({
      credential: cert(JSON.parse(raw)),
      projectId: gcpProjectId(),
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: gcpProjectId(),
  });
}

export function adminAuth() {
  return getAuth(adminApp());
}

let firestoreConfigured = false;

export function db() {
  const instance = getFirestore(adminApp());
  if (!firestoreConfigured) {
    // Treat `undefined` object properties as absent rather than throwing, which
    // keeps optional fields on partial updates from blowing up writes.
    instance.settings({ ignoreUndefinedProperties: true });
    firestoreConfigured = true;
  }
  return instance;
}
