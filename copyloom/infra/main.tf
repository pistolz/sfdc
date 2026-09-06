# ---------------------------------------------------------------------------
# Copyloom infrastructure.
#
# Provisions everything the app needs on GCP:
#   API enablement -> Artifact Registry -> Firestore -> runtime identity ->
#   Stripe secrets -> Cloud Run service -> public invoker binding.
#
# The design goal is keyless credentials: the Cloud Run service runs as a
# dedicated service account that holds roles/aiplatform.user, so the Anthropic
# Vertex SDK authenticates to Claude via Application Default Credentials. No
# Anthropic API key and no service-account JSON file exists anywhere.
#
# NOTE: the container image must already be pushed before `apply` — Cloud Run
# validates that it can pull it. Run scripts/deploy.sh (or the build half of
# cloudbuild.yaml) first, or pass a public placeholder image on the very first
# apply.
# ---------------------------------------------------------------------------

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  # Enabled before anything else; every other resource depends on this set.
  services = [
    "run.googleapis.com",             # Cloud Run
    "aiplatform.googleapis.com",      # Vertex AI (Claude via Model Garden)
    "firestore.googleapis.com",       # Firestore Native
    "secretmanager.googleapis.com",   # Stripe secrets
    "artifactregistry.googleapis.com", # container images
    "cloudbuild.googleapis.com",      # CI build + deploy
    "identitytoolkit.googleapis.com", # Firebase Authentication
  ]

  runtime_roles = [
    # The one that makes keyless Claude calls work: lets the runtime service
    # account call Vertex AI's :streamRawPredict on Anthropic publisher models.
    "roles/aiplatform.user",
    # Firestore Native data plane read/write.
    "roles/datastore.user",
    # Read the Stripe secret versions mounted below.
    "roles/secretmanager.secretAccessor",
  ]

  # Billing is optional. With no Stripe key the secrets are not created, the
  # container gets no Stripe env vars, and src/lib/env.ts isBillingEnabled()
  # reports false so the app shows a "billing not configured" notice instead of
  # buttons that cannot work. Set stripe_secret_key and re-apply to turn it on.
  billing_enabled = var.stripe_secret_key != ""

  # Logical key -> Secret Manager secret ID. Deliberately NOT sensitive, so it
  # can be used as a for_each key (Terraform rejects sensitive for_each values).
  stripe_secret_ids = local.billing_enabled ? {
    stripe_secret_key     = "copyloom-stripe-secret-key"
    stripe_webhook_secret = "copyloom-stripe-webhook-secret"
  } : {}

  # Container env var name -> logical secret key, for the dynamic block below.
  stripe_env = local.billing_enabled ? {
    STRIPE_SECRET_KEY     = "stripe_secret_key"
    STRIPE_WEBHOOK_SECRET = "stripe_webhook_secret"
  } : {}

  # Same keys, the actual sensitive payloads.
  stripe_secret_values = {
    stripe_secret_key     = var.stripe_secret_key
    stripe_webhook_secret = var.stripe_webhook_secret
  }

  # Non-secret container configuration. Optional values are only emitted when
  # set, so that src/lib/env.ts falls back cleanly instead of seeing "".
  plain_env = merge(
    {
      NODE_ENV = "production"
      # Cloud Run does not inject GOOGLE_CLOUD_PROJECT (that is an App Engine /
      # Cloud Functions behaviour), so set it explicitly. The Vertex and
      # Firestore clients both read it.
      GOOGLE_CLOUD_PROJECT = var.project_id
      VERTEX_REGION        = var.vertex_region
      VERTEX_MODEL         = var.vertex_model
      FIREBASE_API_KEY     = var.firebase_api_key
      FIREBASE_AUTH_DOMAIN = var.firebase_auth_domain
    },
    var.app_url == "" ? {} : { APP_URL = var.app_url },
    var.stripe_price_starter == "" ? {} : { STRIPE_PRICE_STARTER = var.stripe_price_starter },
    var.stripe_price_pro == "" ? {} : { STRIPE_PRICE_PRO = var.stripe_price_pro },
    var.stripe_price_agency == "" ? {} : { STRIPE_PRICE_AGENCY = var.stripe_price_agency },
  )

  repository_path = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.containers.repository_id}"
}

# ---------------------------------------------------------------------------
# 1. API enablement
# ---------------------------------------------------------------------------

resource "google_project_service" "enabled" {
  for_each = toset(local.services)

  project = var.project_id
  service = each.value

  # Leave APIs on if the Terraform state is destroyed — disabling them would
  # break anything else in the project that shares them.
  disable_on_destroy         = false
  disable_dependent_services = false
}

# ---------------------------------------------------------------------------
# 2. Artifact Registry
# ---------------------------------------------------------------------------

resource "google_artifact_registry_repository" "containers" {
  project       = var.project_id
  location      = var.region
  repository_id = var.repository_id
  description   = "Copyloom container images"
  format        = "DOCKER"

  depends_on = [google_project_service.enabled]
}

# ---------------------------------------------------------------------------
# 3. Firestore (Native mode)
# ---------------------------------------------------------------------------

resource "google_firestore_database" "default" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"

  concurrency_mode                  = "OPTIMISTIC"
  app_engine_integration_mode       = "DISABLED"
  delete_protection_state           = "DELETE_PROTECTION_ENABLED"
  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_ENABLED"

  # A project may only ever have one (default) database and its location is
  # permanent. Delete protection above is what stops an accidental teardown
  # from taking the data with it; see DEPLOY.md troubleshooting for how to
  # deliberately remove it.
  depends_on = [google_project_service.enabled]
}

# ---------------------------------------------------------------------------
# 4. Runtime identity
# ---------------------------------------------------------------------------

resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = var.service_account_id
  display_name = "Copyloom Cloud Run runtime"
  description  = "Identity for the Copyloom Cloud Run service; calls Vertex AI, Firestore and Secret Manager without any static key."

  depends_on = [google_project_service.enabled]
}

resource "google_project_iam_member" "runtime" {
  for_each = toset(local.runtime_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

# ---------------------------------------------------------------------------
# 5. Stripe secrets
# ---------------------------------------------------------------------------

resource "google_secret_manager_secret" "stripe" {
  for_each = local.stripe_secret_ids

  project   = var.project_id
  secret_id = each.value

  replication {
    auto {}
  }

  labels = {
    app       = "copyloom"
    component = "billing"
  }

  depends_on = [google_project_service.enabled]
}

resource "google_secret_manager_secret_version" "stripe" {
  for_each = local.stripe_secret_ids

  secret = google_secret_manager_secret.stripe[each.key].id

  # Secret Manager rejects an empty payload, and the webhook secret cannot be
  # known until the service URL exists (see var.stripe_webhook_secret). Seed a
  # placeholder so the first apply succeeds and the revision can start; the
  # webhook simply rejects every signature until the real value is set.
  secret_data = (
    local.stripe_secret_values[each.key] != ""
    ? local.stripe_secret_values[each.key]
    : "placeholder-replace-after-first-apply"
  )

  # Keep the previous version around briefly so an in-flight revision that has
  # already resolved "latest" is not broken by a rotation.
  deletion_policy = "DISABLE"
}

# ---------------------------------------------------------------------------
# 6. Cloud Run service
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "app" {
  project  = var.project_id
  name     = var.service_name
  location = var.region

  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.runtime.email

    # Generations stream for a long time; the default 300s cuts them off.
    timeout                          = "600s"
    max_instance_request_concurrency = 80

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }

    containers {
      image = var.image

      ports {
        name           = "http1"
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }

        # Streaming responses keep the request open, so CPU is allocated for
        # the whole request either way; releasing it between requests is what
        # keeps an idle min-instance-0 service free.
        cpu_idle          = true
        startup_cpu_boost = true
      }

      # Plain, non-secret configuration.
      dynamic "env" {
        for_each = local.plain_env

        content {
          name  = env.key
          value = env.value
        }
      }

      # Secrets are referenced, never copied into the service definition. Emitted
      # only when billing is configured, so a Stripe-less deploy does not
      # reference a secret that does not exist (Cloud Run refuses to start a
      # revision whose secret is missing).
      dynamic "env" {
        for_each = local.stripe_env

        content {
          name = env.key

          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.stripe[env.value].secret_id
              version = "latest"
            }
          }
        }
      }

      startup_probe {
        tcp_socket {
          port = 8080
        }

        initial_delay_seconds = 5
        timeout_seconds       = 5
        period_seconds        = 10
        failure_threshold     = 6
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.enabled,
    google_project_iam_member.runtime,
    google_secret_manager_secret_version.stripe,
    google_firestore_database.default,
  ]
}

# ---------------------------------------------------------------------------
# 7. Public access — Copyloom is a public marketing site plus an app whose own
#    routes enforce Firebase ID-token auth, so Cloud Run itself is open.
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = google_cloud_run_v2_service.app.location
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
