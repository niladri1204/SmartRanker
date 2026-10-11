/**
 * Server-only execution context environment configuration.
 * Validates, types, and provides safe defaults for all runtime environment variables.
 * Composes client-safe public configurations with private server secrets.
 */
import { clientEnvConfig, ClientEnvConfig } from "./client-env";

export interface AppEnvConfig extends ClientEnvConfig {
  readonly nodeEnv: "development" | "production" | "test";
  readonly isProduction: boolean;
  readonly isDevelopment: boolean;
  readonly openAiApiKey?: string;
  readonly openAiEmbeddingModel: string;
}

function getServerEnvString(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const envConfig: AppEnvConfig = Object.freeze({
  ...clientEnvConfig,
  nodeEnv: (process.env.NODE_ENV ?? "development") as
    "development" | "production" | "test",
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV !== "production",
  openAiApiKey: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : undefined,
  openAiEmbeddingModel: getServerEnvString("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small").trim(),
});
