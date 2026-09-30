import { APP_CONFIG } from "@/config/app";
import { envConfig } from "@/config/env";
import { UploadedFileItem } from "./types";

export interface ValidationOutcome {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a job description text input against system constraints.
 */
export function validateJobDescriptionInput(text: string): ValidationOutcome {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: "Job description cannot be empty. Please provide role requirements.",
    };
  }

  if (trimmed.length < APP_CONFIG.limits.minJobDescriptionLength) {
    return {
      isValid: false,
      error: `Job description is too brief (${trimmed.length} chars). Minimum recommended is ${APP_CONFIG.limits.minJobDescriptionLength} characters for accurate scoring.`,
    };
  }

  if (trimmed.length > APP_CONFIG.limits.maxJobDescriptionLength) {
    return {
      isValid: false,
      error: `Job description exceeds maximum limit of ${APP_CONFIG.limits.maxJobDescriptionLength} characters.`,
    };
  }

  return { isValid: true };
}

/**
 * Validates an individual candidate file against type, size, and duplicate rules.
 */
export function validateCandidateFile(
  file: File,
  existingFiles: readonly UploadedFileItem[]
): ValidationOutcome {
  // Check duplicates
  const isDuplicate = existingFiles.some(
    (existing) => existing.name === file.name && existing.size === file.size
  );
  if (isDuplicate) {
    return {
      isValid: false,
      error: `"${file.name}" has already been added.`,
    };
  }

  // Check file size
  if (file.size > envConfig.maxUploadSizeBytes) {
    const maxMb = envConfig.maxUploadSizeBytes / (1024 * 1024);
    return {
      isValid: false,
      error: `"${file.name}" exceeds the maximum file size of ${maxMb}MB.`,
    };
  }

  // Check extension & MIME
  const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  const isExtensionAllowed = (
    APP_CONFIG.acceptedFileExtensions as readonly string[]
  ).includes(extension);
  const isMimeAllowed =
    envConfig.allowedMimeTypes.includes(file.type) || file.type === "";

  if (!isExtensionAllowed && !isMimeAllowed) {
    return {
      isValid: false,
      error: `"${file.name}" is not a supported format. Please upload PDF, DOCX, or TXT documents.`,
    };
  }

  return { isValid: true };
}
