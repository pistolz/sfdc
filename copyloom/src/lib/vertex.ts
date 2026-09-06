import "server-only";
import { GoogleGenAI } from "@google/genai";
import { vertexConfig } from "./env";

/**
 * Gemini on Vertex AI.
 *
 * Authentication is Application Default Credentials: on Cloud Run the attached
 * service account (granted roles/aiplatform.user) is used automatically, so
 * there is no model API key stored anywhere in the system and model spend lands
 * on the same GCP bill as the rest of the infrastructure. `vertexai: true` is
 * what selects that path — the SDK falls back to an API-key Gemini API client
 * without it.
 */
let client: GoogleGenAI | null = null;

export function vertex(): GoogleGenAI {
  if (!client) {
    const { projectId, region } = vertexConfig();
    client = new GoogleGenAI({
      vertexai: true,
      project: projectId,
      location: region,
      httpOptions: {
        // Generations stream for a while; keep well inside the Cloud Run timeout.
        timeout: 9 * 60 * 1000,
        // `attempts` counts the original request, so 3 means two retries — the
        // SDK would otherwise retry five times and blow past that timeout.
        retryOptions: { attempts: 3 },
      },
    });
  }
  return client;
}

export function modelId(): string {
  return vertexConfig().model;
}
