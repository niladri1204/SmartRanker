/**
 * Client-safe configuration module.
 * Exposes only public, client-safe variables and constants.
 * NEVER import server secrets or private environment variables into this module.
 */

function getClientEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function getClientEnvString(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export interface ClientEnvConfig {
  readonly appUrl: string;
  readonly maxUploadSizeBytes: number;
  readonly maxResumeFiles: number;
  readonly allowedMimeTypes: readonly string[];
}

export const clientEnvConfig: ClientEnvConfig = Object.freeze({
  appUrl: getClientEnvString("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  maxUploadSizeBytes:
    getClientEnvNumber("NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB", 10) * 1024 * 1024,
  maxResumeFiles: getClientEnvNumber("NEXT_PUBLIC_MAX_RESUME_FILES", 25),
  allowedMimeTypes: Object.freeze([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ]),
});