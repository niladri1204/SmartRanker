/**
 * Server-only execution context
 * DOCX Document Parser Service implementation using mammoth.
 * Extracts raw text, character count, and metadata from in-memory
 * DOCX buffers while keeping the library encapsulated.
 */
import mammoth from "mammoth";
import {
  DocumentParseInput,
  IDocumentParser,
  ParsedDocumentOutput,
} from "./document-parser.interface";
import { DocumentProcessingError } from "@/lib/errors";
import { SupportedDocumentFormat } from "@/types";

export class DocxParserService implements IDocumentParser {
  public readonly format: SupportedDocumentFormat = "docx";

  public supports(mimeType: string, fileName?: string): boolean {
    if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return true;
    }
    if (fileName && fileName.toLowerCase().endsWith(".docx")) {
      return true;
    }
    return false;
  }

  public async parse(input: DocumentParseInput): Promise<ParsedDocumentOutput> {
    if (!this.supports(input.mimeType, input.fileName)) {
      throw new DocumentProcessingError(
        `Unsupported document format: ${input.mimeType} (${input.fileName}). Only DOCX is supported by DocxParserService.`,
        input.fileName
      );
    }

    try {
      const result = await mammoth.extractRawText({ buffer: input.buffer });

      // Safe normalization: handle null/undefined fallbacks and normalize line endings to LF
      const normalizedText = (result.value ?? "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim();

      const characterCount = normalizedText.length;

      const warnings: string[] = [];
      if (Array.isArray(result.messages)) {
        for (const msg of result.messages) {
          if (
            msg &&
            typeof msg.message === "string" &&
            msg.message.trim().length > 0
          ) {
            warnings.push(msg.message.trim());
          }
        }
      }

      if (characterCount === 0) {
        warnings.push(
          "DOCX document contains no extractable text. The file may be empty or contain unsupported embedded elements."
        );
      }

      const extractedMetadata: Record<string, unknown> = {
        fileName: input.fileName,
        byteSize: input.byteSize,
        parser: "DocxParserService",
        messageCount: result.messages?.length ?? 0,
      };

      return {
        rawText: normalizedText,
        characterCount,
        format: "docx",
        warnings,
        extractedMetadata,
      };
    } catch (error) {
      if (error instanceof DocumentProcessingError) {
        throw error;
      }

      const rawMessage =
        error instanceof Error ? error.message : "Unknown error during DOCX extraction";
      // Ensure error message does not expose document text or buffer contents
      const safeMessage = rawMessage.replace(/[\r\n]+/g, " ").slice(0, 200);

      throw new DocumentProcessingError(
        `Failed to parse DOCX document "${input.fileName}": ${safeMessage}`,
        input.fileName,
        error
      );
    }
  }
}

export const docxParserService = new DocxParserService();
