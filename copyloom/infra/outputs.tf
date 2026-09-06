output "service_url" {
  description = "Public HTTPS URL of the Cloud Run service. Set this as app_url and as the Stripe webhook host, and add its hostname to the Firebase authorised domains."
  value       = google_cloud_run_v2_service.app.uri
}

output "service_account_email" {
  description = "Runtime service account used by Cloud Run. This is the identity that calls Vertex AI, Firestore and Secret Manager."
  value       = google_service_account.runtime.email
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository path to push images to, e.g. us-central1-docker.pkg.dev/PROJECT/copyloom."
  value       = local.repository_path
}

output "image_name" {
  description = "Fully qualified image name convention for this deployment."
  value       = "${local.repository_path}/${var.service_name}"
}

output "stripe_webhook_url" {
  description = "Endpoint URL to register in the Stripe dashboard."
  value       = "${google_cloud_run_v2_service.app.uri}/api/webhooks/stripe"
}
