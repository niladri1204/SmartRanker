/**
 * Server-only execution context
 */
import {
  DocumentParseInput,
  IDocumentParser,
  ParsedDocumentOutput,
} from "./document-parser.interface";
import { DocumentProcessingError } from "@/lib/errors";

/**
 * PDF Document Parser Service Stub.
 * Foundation for production PDF parsing (Phase 2).
 */
export class PdfParserService implements IDocumentParser {
  public supports(mimeType: string, fileName?: string): boolean {
    if (mimeType === "application/pdf") return true;
    if (fileName && fileName.toLowerCase().endsWith(".pdf")) return true;
    return false;
  }

  public async parse(input: DocumentParseInput): Promise<ParsedDocumentOutput> {
    if (!this.supports(input.mimeType, input.fileName)) {
      throw new DocumentProcessingError(
        `Unsupported document format: ${input.mimeType}`,
        input.fileName
      );
    }

    // Phase 2 will plug in pdf-parse / unpdf / native extraction engine here.
    return {
      rawText: "",
      pageCount: 1,
      characterCount: 0,
      extractedMetadata: {
        fileName: input.fileName,
        parser: "PdfParserService",
      },
    };
  }
}

export const pdfParserService = new PdfParserService();
