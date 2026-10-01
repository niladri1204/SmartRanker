/**
 * Server-only execution context
 */
import {
  DocumentParseInput,
  IDocumentParser,
  ParsedDocumentOutput,
} from "./document-parser.interface";
import { DocumentProcessingError } from "@/lib/errors";
import { SupportedDocumentFormat } from "@/types";

/**
 * DOCX Document Parser Service Stub.
 * Architectural foundation for DOCX raw-text extraction.
 * Actual mammoth.extractRawText extraction logic is deferred to Phase 2.2.
 */
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
        `Unsupported document format: ${input.mimeType}`,
        input.fileName
      );
    }

    // Phase 2.2 will plug in mammoth extraction here:
    // const result = await mammoth.extractRawText({ buffer: input.buffer });
    return {
      rawText: "",
      characterCount: 0,
      format: "docx",
      warnings: [],
      extractedMetadata: {
        fileName: input.fileName,
        byteSize: input.byteSize,
        parser: "DocxParserService",
      },
    };
  }
}

export const docxParserService = new DocxParserService();
