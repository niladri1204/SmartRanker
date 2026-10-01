/**
 * Server-only execution context
 * Pure utility functions for document format detection, filename sanitization,
 * and DocumentParseInput factory validation.
 */
import { SupportedDocumentFormat } from "@/types";
import { DocumentProcessingError, ValidationError } from "@/lib/errors";
import { DocumentParseInput, ParsedDocumentOutput } from "./document-parser.interface";

export const SUPPORTED_MIME_TYPES: Readonly<Record<string, SupportedDocumentFormat>> =
  Object.freeze({
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
  });

export const SUPPORTED_FILE_EXTENSIONS: Readonly<
  Record<string, SupportedDocumentFormat>
> = Object.freeze({
  ".pdf": "pdf",
  ".docx": "docx",
  ".txt": "txt",
});

/**
 * Sanitizes an incoming filename to prevent directory traversal.
 * Strips any leading paths and keeps only the base filename.
 */
export function sanitizeFileName(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) {
    return "untitled_document";
  }
  // Remove Windows and POSIX directory separators and parent directory tokens
  const base = trimmed.split(/[/\\]/).pop() ?? trimmed;
  // Strip control characters and sanitize
  const cleaned = base.replace(/[\x00-\x1f\x80-\x9f]/g, "").trim();
  return cleaned || "untitled_document";
}

/**
 * Detects the supported document format from MIME type or file extension.
 * Returns null if format is unsupported.
 */
export function detectDocumentFormat(
  fileName: string,
  mimeType?: string
): SupportedDocumentFormat | null {
  if (mimeType && mimeType in SUPPORTED_MIME_TYPES) {
    return SUPPORTED_MIME_TYPES[mimeType];
  }

  const sanitized = sanitizeFileName(fileName).toLowerCase();
  for (const [ext, format] of Object.entries(SUPPORTED_FILE_EXTENSIONS)) {
    if (sanitized.endsWith(ext)) {
      return format;
    }
  }

  return null;
}

/**
 * Factory and validator for creating a DocumentParseInput from in-memory buffers.
 * Validates buffer presence, non-zero size, filename sanitization, and format support.
 */
export function createDocumentParseInput(params: {
  fileName: string;
  mimeType: string;
  buffer: Buffer | Uint8Array;
  byteSize?: number;
}): DocumentParseInput {
  const sanitizedName = sanitizeFileName(params.fileName);
  if (!sanitizedName || sanitizedName === "untitled_document") {
    throw new ValidationError("Document filename cannot be empty.", {
      fileName: ["A valid document filename is required."],
    });
  }

  if (!params.buffer || params.buffer.byteLength === 0) {
    throw new DocumentProcessingError(
      `Cannot parse empty document buffer for "${sanitizedName}".`,
      sanitizedName
    );
  }

  const buf = Buffer.isBuffer(params.buffer)
    ? params.buffer
    : Buffer.from(
        params.buffer.buffer,
        params.buffer.byteOffset,
        params.buffer.byteLength
      );

  const actualSize = buf.byteLength;
  if (params.byteSize !== undefined && params.byteSize !== actualSize) {
    throw new ValidationError(
      `Document byte size mismatch: declared ${params.byteSize}, actual ${actualSize}.`,
      {
        byteSize: ["Document byte size does not match buffer length."],
      }
    );
  }

  const format = detectDocumentFormat(sanitizedName, params.mimeType);
  if (!format) {
    throw new DocumentProcessingError(
      `Unsupported document format for "${sanitizedName}" (${params.mimeType}). Supported formats: PDF, DOCX, TXT.`,
      sanitizedName
    );
  }

  return {
    fileName: sanitizedName,
    mimeType: params.mimeType,
    byteSize: actualSize,
    buffer: buf,
  };
}

/**
 * Returns a security-safe document parse summary (metadata only, no text content logged).
 */
export function summarizeParsedDocument(output: ParsedDocumentOutput): string {
  const warningsCount = output.warnings?.length ?? 0;
  return `[${output.format.toUpperCase()}] ${output.characterCount} chars${
    output.pageCount !== undefined ? `, ${output.pageCount} page(s)` : ""
  }${warningsCount > 0 ? `, ${warningsCount} warning(s)` : ""}`;
}
