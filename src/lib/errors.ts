/**
 * SmartRanker Domain and Application Errors.
 * Provides structured error definitions for validation, parsing, extraction, and ranking.
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(
    message: string,
    code: string = "INTERNAL_ERROR",
    statusCode: number = 500
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  public readonly errors?: Record<string, string[]>;

  constructor(message: string, errors?: Record<string, string[]>) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
    this.errors = errors;
  }
}

export class DocumentProcessingError extends AppError {
  public readonly fileName?: string;

  constructor(message: string, fileName?: string) {
    super(message, "DOCUMENT_PROCESSING_ERROR", 422);
    this.name = "DocumentProcessingError";
    this.fileName = fileName;
  }
}

export class ExtractionError extends AppError {
  constructor(message: string) {
    super(message, "EXTRACTION_ERROR", 422);
    this.name = "ExtractionError";
  }
}

export class RankingError extends AppError {
  constructor(message: string) {
    super(message, "RANKING_ERROR", 500);
    this.name = "RankingError";
  }
}
