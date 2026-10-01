/**
 * Server-only execution context
 * Unified document parser service dispatcher and registry.
 * Isolates third-party extraction libraries behind a stable domain contract.
 */
import {
  DocumentParseInput,
  IDocumentParser,
  ParsedDocumentOutput,
} from "./document-parser.interface";
import { pdfParserService } from "./pdf-parser.service";
import { docxParserService } from "./docx-parser.service";
import { DocumentProcessingError } from "@/lib/errors";

export class CompositeDocumentParserService {
  private readonly parsers: IDocumentParser[];

  constructor(customParsers?: IDocumentParser[]) {
    this.parsers = customParsers ?? [pdfParserService, docxParserService];
  }

  /**
   * Registers a new document parser.
   */
  public registerParser(parser: IDocumentParser): void {
    this.parsers.unshift(parser);
  }

  /**
   * Finds the first registered parser that supports the given document.
   */
  public getParser(mimeType: string, fileName?: string): IDocumentParser | null {
    return this.parsers.find((parser) => parser.supports(mimeType, fileName)) ?? null;
  }

  /**
   * Checks whether the document format is supported by any registered parser.
   */
  public supports(mimeType: string, fileName?: string): boolean {
    return this.getParser(mimeType, fileName) !== null;
  }

  /**
   * Dispatches the document to the appropriate parser implementation.
   * Throws DocumentProcessingError if no compatible parser is found.
   */
  public async parseDocument(input: DocumentParseInput): Promise<ParsedDocumentOutput> {
    const parser = this.getParser(input.mimeType, input.fileName);
    if (!parser) {
      throw new DocumentProcessingError(
        `No document parser available for format: ${input.mimeType} (${input.fileName}).`,
        input.fileName
      );
    }

    return parser.parse(input);
  }
}

export const documentParserService = new CompositeDocumentParserService();
