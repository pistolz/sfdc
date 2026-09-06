/**
 * Runtime environment access.
 *
 * Everything is read lazily at request time rather than at module load, so
 * `next build` succeeds in CI without production secrets present, and one
 * container image can be promoted across dev/staging/prod by changing only
 * Cloud Run env vars.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example.`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

/**
 * GCP project.
 *
 * Cloud Run does not inject GOOGLE_CLOUD_PROJECT (that is an App Engine and
 * Cloud Functions behaviour), so the Terraform in infra/ sets it explicitly on
 * the service. Locally it comes from .env.local or the gcloud config.
 */
export function gcpProjectId(): string {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT_ID ||
    required("GOOGLE_CLOUD_PROJECT")
  );
}

/**
 * Vertex AI settings.
 *
 * `global` spreads across regions and has the best availability; pin a
 * specific region (e.g. `us-central1`) if you have data-residency requirements.
 *
 * Gemini models need no per-project enablement on Vertex, so the default works
 * on a fresh project. The model stays configurable for cost control: set
 * VERTEX_MODEL=gemini-2.5-flash for a cheaper and faster run when the extra
 * quality of Pro is not worth paying for.
 */
export function vertexConfig() {
  return {
    projectId: gcpProjectId(),
    region: optional("VERTEX_REGION", "global"),
    model: optional("VERTEX_MODEL", "gemini-2.5-pro"),
  };
}

/** Public Firebase config, passed to the browser at runtime (never inlined at build). */
export function firebasePublicConfig() {
  return {
    apiKey: required("FIREBASE_API_KEY"),
    authDomain: required("FIREBASE_AUTH_DOMAIN"),
    projectId: gcpProjectId(),
  };
}

export function stripeConfig() {
  return {
    secretKey: required("STRIPE_SECRET_KEY"),
    webhookSecret: required("STRIPE_WEBHOOK_SECRET"),
  };
}

/** Absolute origin, used for Stripe redirect URLs. */
export function appUrl(): string {
  return optional("APP_URL", "http://localhost:8080").replace(/\/$/, "");
}

export function isBillingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
