/**
 * Application environment configuration boundary.
 * Validates, types, and provides safe defaults for all runtime environment variables.
 */

export interface AppEnvConfig {
  readonly nodeEnv: "development" | "production" | "test";
  readonly isProduction: boolean;
  readonly isDevelopment: boolean;
  readonly appUrl: string;
  readonly maxUploadSizeBytes: number;
  readonly maxResumeFiles: number;
  readonly allowedMimeTypes: readonly string[];
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const envConfig: AppEnvConfig = Object.freeze({
  nodeEnv: (process.env.NODE_ENV ?? "development") as
    "development" | "production" | "test",
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV !== "production",
  appUrl: getEnvString("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  maxUploadSizeBytes: getEnvNumber("NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB", 10) * 1024 * 1024,
  maxResumeFiles: getEnvNumber("NEXT_PUBLIC_MAX_RESUME_FILES", 25),
  allowedMimeTypes: Object.freeze([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ]),
});
