/**
 * Server-only execution context.
 * Strongly typed export domain models, contracts, and error definitions for candidate ranking exports.
 */
import { RankingResult } from "@/types";

export type ExportFormat = "csv" | "pdf";

export interface ExportRankedResultsRequest {
  readonly format: ExportFormat;
  readonly jobTitle?: string;
  readonly rankingResults: readonly RankingResult[];
}

export interface ExportResult {
  readonly format: ExportFormat;
  readonly mimeType: string;
  readonly filename: string;
  readonly data: Uint8Array | Buffer;
}

/**
 * Base domain error for export operations.
 */
export class ExportError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = "EXPORT_ERROR", statusCode = 500) {
    super(message);
    this.name = "ExportError";
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, ExportError.prototype);
  }
}

/**
 * Thrown when export inputs are missing, invalid, or malformed.
 */
export class InvalidExportInputError extends ExportError {
  constructor(message: string) {
    super(message, "INVALID_EXPORT_INPUT", 400);
    this.name = "InvalidExportInputError";
    Object.setPrototypeOf(this, InvalidExportInputError.prototype);
  }
}
