/**
 * Server-only execution context
 * PDF Document Parser Service implementation using pdf-parse.
 * Extracts plain text, character count, page count, and metadata
 * from in-memory PDF buffers while keeping the library encapsulated.
 */
import { PDFParse } from "pdf-parse";
import {
  DocumentParseInput,
  IDocumentParser,
  ParsedDocumentOutput,
} from "./document-parser.interface";
import { DocumentProcessingError } from "@/lib/errors";
import { SupportedDocumentFormat } from "@/types";

export class PdfParserService implements IDocumentParser {
  public readonly format: SupportedDocumentFormat = "pdf";

  public supports(mimeType: string, fileName?: string): boolean {
    if (mimeType === "application/pdf") return true;
    if (fileName && fileName.toLowerCase().endsWith(".pdf")) return true;
    return false;
  }

  public async parse(input: DocumentParseInput): Promise<ParsedDocumentOutput> {
    if (!this.supports(input.mimeType, input.fileName)) {
      throw new DocumentProcessingError(
        `Unsupported document format: ${input.mimeType} (${input.fileName}). Only PDF is supported by PdfParserService.`,
        input.fileName
      );
    }

    let parserInstance: PDFParse | null = null;
    try {
      parserInstance = new PDFParse({ data: input.buffer });
      const textResult = await parserInstance.getText({ pageJoiner: "" });

      const pageTexts: string[] = Array.isArray(textResult.pages)
        ? textResult.pages
            .map((page) => (page && typeof page.text === "string" ? page.text : ""))
            .filter((text) => text.length > 0)
        : [];

      const rawCombined =
        pageTexts.length > 0
          ? pageTexts.join("\n\n")
          : typeof textResult.text === "string"
          ? textResult.text
          : "";

      // Safe normalization: handle null/undefined fallbacks and line endings
      const normalizedText = (rawCombined ?? "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim();

      const characterCount = normalizedText.length;

      const pageCount =
        typeof textResult.total === "number" && textResult.total > 0
          ? textResult.total
          : Array.isArray(textResult.pages) && textResult.pages.length > 0
          ? textResult.pages.length
          : undefined;

      const extractedMetadata: Record<string, unknown> = {
        fileName: input.fileName,
        byteSize: input.byteSize,
        parser: "PdfParserService",
      };

      if (pageCount !== undefined) {
        extractedMetadata.pageCount = pageCount;
      }

      // Extract non-critical document metadata if available
      try {
        const infoResult = await parserInstance.getInfo();
        if (infoResult?.info && typeof infoResult.info === "object") {
          const safeInfo: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(infoResult.info)) {
            if (value !== null && value !== undefined && value !== "") {
              safeInfo[key] = value;
            }
          }
          if (Object.keys(safeInfo).length > 0) {
            extractedMetadata.pdfInfo = safeInfo;
          }
        }
        if (infoResult?.fingerprints && Array.isArray(infoResult.fingerprints)) {
          const fingerprints = infoResult.fingerprints.filter(
            (fp): fp is string => typeof fp === "string" && fp.length > 0
          );
          if (fingerprints.length > 0) {
            extractedMetadata.fingerprints = fingerprints;
          }
        }
      } catch {
        // Non-fatal if metadata inspection fails
      }

      const warnings: string[] = [];
      if (characterCount === 0) {
        warnings.push(
          "PDF document contains no extractable text. The file may be image-only, scanned, or empty."
        );
      }

      return {
        rawText: normalizedText,
        characterCount,
        pageCount,
        format: "pdf",
        warnings,
        extractedMetadata,
      };
    } catch (error) {
      if (error instanceof DocumentProcessingError) {
        throw error;
      }

      const rawMessage =
        error instanceof Error ? error.message : "Unknown error during PDF extraction";
      // Ensure error message does not expose document text or buffer contents
      const safeMessage = rawMessage.replace(/[\r\n]+/g, " ").slice(0, 200);

      throw new DocumentProcessingError(
        `Failed to parse PDF document "${input.fileName}": ${safeMessage}`,
        input.fileName,
        error
      );
    } finally {
      if (parserInstance) {
        await parserInstance.destroy().catch(() => {});
      }
    }
  }
}

export const pdfParserService = new PdfParserService();
