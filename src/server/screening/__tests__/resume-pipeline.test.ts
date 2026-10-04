import { describe, it, expect } from "vitest";
import {
  ResumePipelineService,
  resumePipelineService,
  IngestResumeInput,
} from "../index";

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
 * Minimal valid DOCX binary fixture.
 * Embeds paragraphs: "John Doe Lead Developer", "Experienced TypeScript Architect"
 */
const SAMPLE_VALID_DOCX = Buffer.from(
  "UEsDBAoAAAAAAEt5Ql15bjPXrQEAAK0BAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz48VHlwZXMgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9wYWNrYWdlLzIwMDYvY29udGVudC10eXBlcyI+PERlZmF1bHQgRXh0ZW5zaW9uPSJyZWxzIiBDb250ZW50VHlwZT0iYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLXBhY2thZ2UucmVsYXRpb25zaGlwcyt4bWwiLz48RGVmYXVsdCBFeHRlbnNpb249InhtbCIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3htbCIvPjxPdmVycmlkZSBQYXJ0TmFtZT0iL3dvcmQvZG9jdW1lbnQueG1sIiBDb250ZW50VHlwZT0iYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LndvcmRwcm9jZXNzaW5nbWwuZG9jdW1lbnQubWFpbit4bWwiLz48L1R5cGVzPlBLAwQKAAAAAABLeUJdAAAAAAAAAAAAAAAABgAAAF9yZWxzL1BLAwQKAAAAAABLeUJdm/036ikBAAApAQAACwAAAF9yZWxzLy5yZWxzPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/PjxSZWxhdGlvbnNoaXBzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L3JlbGF0aW9uc2hpcHMiPjxSZWxhdGlvbnNoaXAgSWQ9InJJZDEiIFR5cGU9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L3JlbGF0aW9uc2hpcHMvb2ZmaWNlRG9jdW1lbnQiIFRhcmdldD0id29yZC9kb2N1bWVudC54bWwiLz48L1JlbGF0aW9uc2hpcHM+UEsDBAoAAAAAAEt5Ql0AAAAAAAAAAAAAAAAFAAAAd29yZC9QSwMECgAAAAAAS3lCXRoydmQhAQAAIQEAABEAAAB3b3JkL2RvY3VtZW50LnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz48dzpkb2N1bWVudCB4bWxuczp3PSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvd29yZHByb2Nlc3NpbmdtbC8yMDA2L21haW4iPjx3OmJvZHk+PHc6cD48dzpyPjx3OnQ+Sm9obiBEb2UgTGVhZCBEZXZlbG9wZXI8L3c6dD48L3c6cj48L3c6cD48dzpwPjx3OnI+PHc6dD5FeHBlcmllbmNlZCBUeXBlU2NyaXB0IEFyY2hpdGVjdDwvdzp0PjwvdzpyPjwvdzpwPjwvdzpib2R5Pjwvdzpkb2N1bWVudD5QSwECFAAKAAAAAABLeUJdeW4z160BAACtAQAAEwAAAAAAAAAAAAAAAAAAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQIUAAoAAAAAAEt5Ql0AAAAAAAAAAAAAAAAGAAAAAAAAAAAAEAAAAN4BAABfcmVscy9QSwECFAAKAAAAAABLeUJdm/036ikBAAApAQAACwAAAAAAAAAAAAAAAAACAgAAX3JlbHMvLnJlbHNQSwECFAAKAAAAAABLeUJdAAAAAAAAAAAAAAAABQAAAAAAAAAAABAAAABUAwAAd29yZC9QSwECFAAKAAAAAABLeUJdGjJ2ZCEBAAAhAQAAEQAAAAAAAAAAAAAAAAB3AwAAd29yZC9kb2N1bWVudC54bWxQSwUGAAAAAAUABQAgAQAAxwQAAAAA",
  "base64"
);

describe("ResumePipelineService", () => {
  const service = new ResumePipelineService();

  it("should expose singleton instance", () => {
    expect(resumePipelineService).toBeInstanceOf(ResumePipelineService);
  });

  it("should process a valid PDF and return a structured Candidate", async () => {
    const input: IngestResumeInput = {
      fileName: "jane_doe_resume.pdf",
      mimeType: "application/pdf",
      fileBuffer: SAMPLE_VALID_PDF,
      documentId: "doc_test_pdf_1",
    };

    const result = await service.processResume(input);

    expect(result.status).toBe("success");
    expect(result.document.id).toBe("doc_test_pdf_1");
    expect(result.document.fileName).toBe("jane_doe_resume.pdf");
    expect(result.document.status).toBe("parsed");
    expect(result.document.fileSizeBytes).toBe(SAMPLE_VALID_PDF.byteLength);
    expect(result.document.rawText).toContain("Jane Doe Senior Engineer");

    expect(result.candidate).toBeDefined();
    expect(result.candidate?.id).toBe("cand_doc_test_pdf_1");
    expect(result.candidate?.documentId).toBe("doc_test_pdf_1");
    expect(result.candidate?.fullName).toBe("Jane Doe");
    expect(Array.isArray(result.candidate?.skills)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("should process a valid DOCX and return a structured Candidate with skills", async () => {
    const input: IngestResumeInput = {
      fileName: "john_doe_resume.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileBuffer: SAMPLE_VALID_DOCX,
      documentId: "doc_test_docx_1",
    };

    const result = await service.processResume(input);

    expect(result.status).toBe("success");
    expect(result.document.id).toBe("doc_test_docx_1");
    expect(result.document.fileName).toBe("john_doe_resume.docx");
    expect(result.document.status).toBe("parsed");
    expect(result.document.rawText).toContain("John Doe Lead Developer");
    expect(result.document.rawText).toContain("Experienced TypeScript Architect");

    expect(result.candidate).toBeDefined();
    expect(result.candidate?.fullName).toBe("John Doe");
    expect(result.candidate?.skills.some((s) => s.name === "TypeScript")).toBe(true);
  });

  it("should handle a malformed document safely without throwing unhandled exceptions", async () => {
    const corruptBuffer = Buffer.from("Corrupted non-PDF binary payload");
    const input: IngestResumeInput = {
      fileName: "malformed_resume.pdf",
      mimeType: "application/pdf",
      fileBuffer: corruptBuffer,
    };

    const result = await service.processResume(input);

    expect(result.status).toBe("error");
    expect(result.document.status).toBe("error");
    expect(result.document.fileName).toBe("malformed_resume.pdf");
    expect(result.candidate).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");
    expect(result.document.errorMessage).toBe(result.error);
  });

  it("should isolate failures in batch processing without affecting successful documents", async () => {
    const corruptBuffer = Buffer.from("Corrupted non-PDF binary payload");

    const batchInputs: IngestResumeInput[] = [
      {
        fileName: "valid_first.pdf",
        mimeType: "application/pdf",
        fileBuffer: SAMPLE_VALID_PDF,
        documentId: "doc_batch_1",
      },
      {
        fileName: "broken_middle.pdf",
        mimeType: "application/pdf",
        fileBuffer: corruptBuffer,
        documentId: "doc_batch_2",
      },
      {
        fileName: "valid_last.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileBuffer: SAMPLE_VALID_DOCX,
        documentId: "doc_batch_3",
      },
    ];

    const batchResult = await service.processBatch(batchInputs);

    expect(batchResult.totalProcessed).toBe(3);
    expect(batchResult.successfulCount).toBe(2);
    expect(batchResult.failedCount).toBe(1);

    // Document 1 (PDF) succeeded
    expect(batchResult.results[0].status).toBe("success");
    expect(batchResult.results[0].candidate?.fullName).toBe("Jane Doe");

    // Document 2 (Corrupt) failed safely
    expect(batchResult.results[1].status).toBe("error");
    expect(batchResult.results[1].candidate).toBeUndefined();
    expect(batchResult.results[1].error).toBeDefined();

    // Document 3 (DOCX) succeeded independently
    expect(batchResult.results[2].status).toBe("success");
    expect(batchResult.results[2].candidate?.fullName).toBe("John Doe");
    expect(
      batchResult.results[2].candidate?.skills.some((s) => s.name === "TypeScript")
    ).toBe(true);
  });
});
