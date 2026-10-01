import { describe, it, expect } from "vitest";
import {
  detectDocumentFormat,
  sanitizeFileName,
  createDocumentParseInput,
  summarizeParsedDocument,
  PdfParserService,
  pdfParserService,
  DocxParserService,
  docxParserService,
  CompositeDocumentParserService,
  documentParserService,
} from "../index";
import { DocumentProcessingError, ValidationError } from "@/lib/errors";

/**
 * Minimal valid single-page PDF binary fixture.
 * Embeds text: "Jane Doe Senior Engineer"
 */
const SAMPLE_VALID_PDF = Buffer.from(
  "%PDF-1.4\n" +
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n" +
    "4 0 obj\n<< /Length 55 >>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(Jane Doe Senior Engineer) Tj\nET\nendstream\nendobj\n" +
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n" +
    "xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000350 00000 n \n" +
    "trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n433\n%%EOF"
);

/**
 * Minimal valid two-page PDF binary fixture.
 * Page 1 text: "Page One Text"
 * Page 2 text: "Page Two Text"
 */
const SAMPLE_TWO_PAGE_PDF = Buffer.from(
  "%PDF-1.4\n" +
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>\nendobj\n" +
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n" +
    "4 0 obj\n<< /Length 43 >>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(Page One Text) Tj\nET\nendstream\nendobj\n" +
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n" +
    "6 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n" +
    "7 0 obj\n<< /Length 43 >>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(Page Two Text) Tj\nET\nendstream\nendobj\n" +
    "xref\n0 8\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000122 00000 n \n0000000251 00000 n \n0000000345 00000 n \n0000000424 00000 n \n0000000553 00000 n \n" +
    "trailer\n<< /Root 1 0 R /Size 8 >>\nstartxref\n647\n%%EOF"
);

describe("Document Processing Foundation", () => {
  describe("detectDocumentFormat & sanitizeFileName", () => {
    it("should detect PDF from MIME type or file extension", () => {
      expect(detectDocumentFormat("candidate.pdf", "application/pdf")).toBe("pdf");
      expect(detectDocumentFormat("candidate.PDF")).toBe("pdf");
      expect(detectDocumentFormat("resume_no_ext", "application/pdf")).toBe("pdf");
    });

    it("should detect DOCX from OpenXML MIME type or file extension", () => {
      expect(
        detectDocumentFormat(
          "candidate.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
      ).toBe("docx");
      expect(detectDocumentFormat("candidate.DOCX")).toBe("docx");
    });

    it("should detect plain text from MIME type or extension", () => {
      expect(detectDocumentFormat("notes.txt", "text/plain")).toBe("txt");
    });

    it("should return null for unsupported formats", () => {
      expect(
        detectDocumentFormat("executable.exe", "application/octet-stream")
      ).toBeNull();
      expect(detectDocumentFormat("photo.png", "image/png")).toBeNull();
    });

    it("should sanitize filenames and strip directory traversal", () => {
      expect(sanitizeFileName("../../../etc/passwd.pdf")).toBe("passwd.pdf");
      expect(sanitizeFileName("C:\\Windows\\System32\\resume.docx")).toBe("resume.docx");
      expect(sanitizeFileName("  clean_resume.pdf  ")).toBe("clean_resume.pdf");
      expect(sanitizeFileName("")).toBe("untitled_document");
    });
  });

  describe("createDocumentParseInput", () => {
    it("should create valid DocumentParseInput for a PDF buffer", () => {
      const buffer = Buffer.from("mock-pdf-binary-header");
      const input = createDocumentParseInput({
        fileName: "resume.pdf",
        mimeType: "application/pdf",
        buffer,
      });

      expect(input.fileName).toBe("resume.pdf");
      expect(input.mimeType).toBe("application/pdf");
      expect(input.byteSize).toBe(buffer.byteLength);
      expect(Buffer.isBuffer(input.buffer)).toBe(true);
    });

    it("should throw DocumentProcessingError when buffer is empty", () => {
      expect(() =>
        createDocumentParseInput({
          fileName: "empty.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.alloc(0),
        })
      ).toThrow(DocumentProcessingError);
    });

    it("should throw ValidationError when byteSize does not match buffer length", () => {
      expect(() =>
        createDocumentParseInput({
          fileName: "test.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("hello"),
          byteSize: 9999,
        })
      ).toThrow(ValidationError);
    });

    it("should throw DocumentProcessingError for unsupported format", () => {
      expect(() =>
        createDocumentParseInput({
          fileName: "test.exe",
          mimeType: "application/x-msdownload",
          buffer: Buffer.from("binary"),
        })
      ).toThrow(DocumentProcessingError);
    });
  });

  describe("PdfParserService", () => {
    const parser = new PdfParserService();

    it("should expose singleton instance with pdf format", () => {
      expect(pdfParserService).toBeInstanceOf(PdfParserService);
      expect(pdfParserService.format).toBe("pdf");
    });

    it("should identify supported PDF formats", () => {
      expect(parser.supports("application/pdf")).toBe(true);
      expect(parser.supports("application/octet-stream", "test.pdf")).toBe(true);
      expect(parser.supports("text/plain")).toBe(false);
      expect(
        parser.supports(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
      ).toBe(false);
    });

    it("should extract non-empty text and metadata from a valid PDF", async () => {
      const input = createDocumentParseInput({
        fileName: "candidate.pdf",
        mimeType: "application/pdf",
        buffer: SAMPLE_VALID_PDF,
      });

      const output = await parser.parse(input);
      expect(output.format).toBe("pdf");
      expect(output.pageCount).toBe(1);
      expect(output.characterCount).toBeGreaterThan(0);
      expect(output.rawText).toContain("Jane Doe Senior Engineer");
      expect(Array.isArray(output.warnings)).toBe(true);
      expect(output.extractedMetadata?.parser).toBe("PdfParserService");
      expect(output.extractedMetadata?.fileName).toBe("candidate.pdf");
      expect(output.extractedMetadata?.pageCount).toBe(1);
    });

    it("should extract page count when available", async () => {
      const input = createDocumentParseInput({
        fileName: "two_page_resume.pdf",
        mimeType: "application/pdf",
        buffer: SAMPLE_TWO_PAGE_PDF,
      });

      const output = await parser.parse(input);
      expect(output.format).toBe("pdf");
      expect(output.pageCount).toBe(2);
      expect(output.rawText).toContain("Page One Text");
      expect(output.rawText).toContain("Page Two Text");
      expect(output.extractedMetadata?.pageCount).toBe(2);
    });

    it("should throw DocumentProcessingError when parsing invalid or corrupted PDF buffer", async () => {
      const corruptInput = createDocumentParseInput({
        fileName: "corrupt.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-corrupted-random-junk-bytes-that-fail-parsing"),
      });

      await expect(parser.parse(corruptInput)).rejects.toThrow(DocumentProcessingError);
      await expect(parser.parse(corruptInput)).rejects.toThrow(
        /Failed to parse PDF document "corrupt\.pdf"/
      );
    });

    it("should throw DocumentProcessingError when parsing unsupported input format", async () => {
      const input = {
        fileName: "file.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        byteSize: 10,
        buffer: Buffer.from("mock"),
      };

      await expect(parser.parse(input)).rejects.toThrow(DocumentProcessingError);
    });
  });

  describe("DocxParserService", () => {
    const parser = new DocxParserService();

    it("should expose singleton instance with docx format", () => {
      expect(docxParserService).toBeInstanceOf(DocxParserService);
      expect(docxParserService.format).toBe("docx");
    });

    it("should identify supported DOCX formats", () => {
      expect(
        parser.supports(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
      ).toBe(true);
      expect(parser.supports("application/octet-stream", "resume.docx")).toBe(true);
      expect(parser.supports("application/pdf")).toBe(false);
    });

    it("should parse DOCX input into valid stub output", async () => {
      const input = createDocumentParseInput({
        fileName: "resume.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer: Buffer.from("PK mock docx zip binary"),
      });

      const output = await parser.parse(input);
      expect(output.format).toBe("docx");
      expect(output.characterCount).toBe(0);
      expect(Array.isArray(output.warnings)).toBe(true);
      expect(output.extractedMetadata?.parser).toBe("DocxParserService");
    });

    it("should throw DocumentProcessingError when parsing unsupported input", async () => {
      const input = {
        fileName: "file.pdf",
        mimeType: "application/pdf",
        byteSize: 10,
        buffer: Buffer.from("mock"),
      };

      await expect(parser.parse(input)).rejects.toThrow(DocumentProcessingError);
    });
  });

  describe("CompositeDocumentParserService", () => {
    it("should route PDF and DOCX documents to their respective parsers", async () => {
      const pdfInput = createDocumentParseInput({
        fileName: "resume.pdf",
        mimeType: "application/pdf",
        buffer: SAMPLE_VALID_PDF,
      });
      const docxInput = createDocumentParseInput({
        fileName: "resume.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer: Buffer.from("PK docx data"),
      });

      const pdfOutput = await documentParserService.parseDocument(pdfInput);
      const docxOutput = await documentParserService.parseDocument(docxInput);

      expect(pdfOutput.format).toBe("pdf");
      expect(pdfOutput.rawText).toContain("Jane Doe Senior Engineer");
      expect(docxOutput.format).toBe("docx");
    });

    it("should throw DocumentProcessingError when format has no registered parser", async () => {
      const emptyRegistry = new CompositeDocumentParserService([]);
      const input = createDocumentParseInput({
        fileName: "resume.pdf",
        mimeType: "application/pdf",
        buffer: SAMPLE_VALID_PDF,
      });

      await expect(emptyRegistry.parseDocument(input)).rejects.toThrow(
        DocumentProcessingError
      );
    });

    it("should allow dynamic registration of custom parsers", () => {
      const service = new CompositeDocumentParserService([]);
      expect(service.supports("application/pdf")).toBe(false);

      service.registerParser(pdfParserService);
      expect(service.supports("application/pdf")).toBe(true);
    });
  });

  describe("summarizeParsedDocument", () => {
    it("should produce a safe summary without logging document text", () => {
      const summary = summarizeParsedDocument({
        rawText: "Secret resume content that must never be in logs",
        characterCount: 1540,
        pageCount: 2,
        format: "pdf",
        warnings: ["Non-fatal font issue"],
      });

      expect(summary).toBe("[PDF] 1540 chars, 2 page(s), 1 warning(s)");
      expect(summary.includes("Secret resume content")).toBe(false);
    });
  });
});
