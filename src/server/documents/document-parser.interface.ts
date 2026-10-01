import { SupportedDocumentFormat } from "@/types";

/**
 * Standardized input payload for server-side document parsing.
 * Requires in-memory binary Buffer and validated document metadata.
 * Does not accept filesystem paths or remote URLs.
 */
export interface DocumentParseInput {
  readonly fileName: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly buffer: Buffer;
}

/**
 * Normalized output result produced by document parsers.
 * Contains extracted text, metrics, detected format, optional metadata,
 * and non-fatal warnings encountered during extraction.
 */
export interface ParsedDocumentOutput {
  readonly rawText: string;
  readonly characterCount: number;
  readonly pageCount?: number;
  readonly format: SupportedDocumentFormat;
  readonly warnings?: readonly string[];
  readonly extractedMetadata?: Readonly<Record<string, unknown>>;
}

/**
 * Interface contract for format-specific document parsers (PDF, DOCX).
 */
export interface IDocumentParser {
  readonly format: SupportedDocumentFormat;

  /**
   * Checks whether this parser handles the given MIME type or file extension.
   */
  supports(mimeType: string, fileName?: string): boolean;

  /**
   * Parses an in-memory document buffer into normalized document text.
   */
  parse(input: DocumentParseInput): Promise<ParsedDocumentOutput>;
}
