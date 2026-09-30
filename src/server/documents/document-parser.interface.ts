/**
 * Interface definition for document parsers.
 * Abstracts PDF/Word/Text extraction away from specific parsing libraries.
 */

export interface DocumentParseInput {
  readonly fileName: string;
  readonly mimeType: string;
  readonly buffer: Uint8Array | Buffer;
}

export interface ParsedDocumentOutput {
  readonly rawText: string;
  readonly pageCount?: number;
  readonly characterCount: number;
  readonly extractedMetadata?: Record<string, unknown>;
}

export interface IDocumentParser {
  /**
   * Parses binary document payload into normalized text content.
   */
  parse(input: DocumentParseInput): Promise<ParsedDocumentOutput>;

  /**
   * Returns whether this parser handles the given mime type or file extension.
   */
  supports(mimeType: string, fileName?: string): boolean;
}
