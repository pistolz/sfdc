import "server-only";
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import { vertexConfig } from "./env";

/**
 * Claude on Vertex AI.
 *
 * Authentication is Application Default Credentials: on Cloud Run the attached
 * service account (granted roles/aiplatform.user) is used automatically, so
 * there is no model API key stored anywhere in the system and model spend lands
 * on the same GCP bill as the rest of the infrastructure.
 */
let client: AnthropicVertex | null = null;

export function vertex(): AnthropicVertex {
  if (!client) {
    const { projectId, region } = vertexConfig();
    client = new AnthropicVertex({
      projectId,
      region,
      // Generations stream for a while; keep well inside the Cloud Run timeout.
      timeout: 9 * 60 * 1000,
      maxRetries: 2,
    });
  }
  return client;
}

export function modelId(): string {
  return vertexConfig().model;
}
