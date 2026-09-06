# ---------------------------------------------------------------------------
# Input variables.
#
# Only project_id and the Stripe/Firebase values have no sensible default;
# everything else is pre-set for a standard single-region deployment.
# ---------------------------------------------------------------------------

variable "project_id" {
  description = "GCP project ID that hosts Copyloom."
  type        = string
}

variable "region" {
  description = "Region for Cloud Run, Artifact Registry and Cloud Build."
  type        = string
  default     = "us-central1"
}

variable "firestore_location" {
  description = <<-EOT
    Location of the Firestore database. This is a Firestore location, not a
    compute region: use a multi-region ("nam5" for the US, "eur3" for Europe)
    or a single region such as "us-central1". It is fixed for the lifetime of
    the database and cannot be changed afterwards.
  EOT
  type        = string
  default     = "nam5"
}

variable "service_name" {
  description = "Cloud Run service name. Also forms the default hostname."
  type        = string
  default     = "copyloom"

  validation {
    condition     = can(regex("^[a-z]([-a-z0-9]{0,47}[a-z0-9])?$", var.service_name))
    error_message = "service_name must be lowercase alphanumeric with hyphens, starting with a letter, max 49 chars."
  }
}

variable "repository_id" {
  description = "Artifact Registry Docker repository ID."
  type        = string
  default     = "copyloom"
}

variable "service_account_id" {
  description = "Account ID (local part) of the Cloud Run runtime service account."
  type        = string
  default     = "copyloom-run"

  validation {
    condition     = can(regex("^[a-z]([-a-z0-9]{4,28}[a-z0-9])$", var.service_account_id))
    error_message = "service_account_id must be 6-30 lowercase alphanumeric/hyphen characters starting with a letter."
  }
}

variable "image" {
  description = <<-EOT
    Fully qualified container image to run, e.g.
    us-central1-docker.pkg.dev/my-project/copyloom/copyloom:latest

    Build and push it first (scripts/deploy.sh, or cloudbuild.yaml), then apply.
  EOT
  type        = string
}

# --- Vertex AI -------------------------------------------------------------

variable "vertex_region" {
  description = <<-EOT
    Vertex AI serving region for Claude. "global" is recommended for
    availability; use a specific region only for data residency. The chosen
    model must be enabled in Model Garden for that location.
  EOT
  type        = string
  default     = "global"
}

variable "vertex_model" {
  description = <<-EOT
    Claude model ID on Vertex AI (bare ID, no prefix). Defaults to
    claude-opus-5. If Opus 5 is not enabled for the project in Vertex AI Model
    Garden, set this to claude-sonnet-5.
  EOT
  type        = string
  default     = "claude-opus-5"
}

# --- Firebase Authentication ----------------------------------------------

variable "firebase_api_key" {
  description = "Firebase Web API key (Firebase console > Project settings > General). Public by design."
  type        = string
}

variable "firebase_auth_domain" {
  description = "Firebase auth domain, normally <project-id>.firebaseapp.com."
  type        = string
}

# --- Application -----------------------------------------------------------

variable "app_url" {
  description = <<-EOT
    Public origin of the app, without a trailing slash, used for Stripe
    redirect URLs.

    Leave empty on the FIRST apply: the Cloud Run URL does not exist yet. Read
    the `service_url` output, set this to it (or to your custom domain), and
    apply again. When empty, APP_URL is simply not set on the container.
  EOT
  type        = string
  default     = ""

  validation {
    condition     = var.app_url == "" || can(regex("^https?://[^/]+$", var.app_url))
    error_message = "app_url must be empty or an absolute origin with no trailing slash, e.g. https://copyloom-abc123-uc.a.run.app."
  }
}

# --- Stripe ----------------------------------------------------------------

variable "stripe_secret_key" {
  description = <<-EOT
    Stripe secret key (sk_live_... / sk_test_...). Stored in Secret Manager.

    Leave empty to deploy without billing: no Stripe secrets are created, the
    container gets no Stripe env vars, and the app renders the billing page as
    "not configured" rather than showing buttons that cannot work. Set it and
    re-apply whenever you are ready to charge.
  EOT
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_webhook_secret" {
  description = <<-EOT
    Stripe webhook signing secret (whsec_...). Stored in Secret Manager.

    Chicken-and-egg: the endpoint cannot be created in Stripe until the service
    URL exists. Apply once with a placeholder, create the webhook against the
    service URL, then set the real value and apply again.
  EOT
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_price_starter" {
  description = "Stripe price ID (price_...) for the Starter plan."
  type        = string
  default     = ""
}

variable "stripe_price_pro" {
  description = "Stripe price ID (price_...) for the Pro plan."
  type        = string
  default     = ""
}

variable "stripe_price_agency" {
  description = "Stripe price ID (price_...) for the Agency plan."
  type        = string
  default     = ""
}
