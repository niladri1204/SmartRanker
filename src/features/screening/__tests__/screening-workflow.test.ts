import { describe, it, expect } from "vitest";
import { submitScreeningResumes } from "../screening-api";
import { UploadedFileItem } from "../types";
import { Candidate, ResumeDocument } from "@/types";

function createMockFileItem(name: string, content = "Mock resume text content"): UploadedFileItem {
  const file = new File([content], name, {
    type: name.endsWith(".pdf")
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  return {
    id: `file_${name}`,
    file,
    name,
    size: file.size,
    type: file.type,
    status: "ready",
    uploadedAt: new Date().toISOString(),
  };
}

describe("Phase 2.9: Frontend Screening Workflow API Integration", () => {
  it("1. successful screening request updates workflow with returned candidates", async () => {
    const mockCandidate: Candidate = {
      id: "cand_1",
      documentId: "doc_1",
      fullName: "Jane Developer",
      email: "jane@example.com",
      phone: "+1-555-0100",
      skills: [{ name: "TypeScript" }, { name: "React" }],
      experiences: [{ id: "exp_1", role: "Senior Engineer", company: "TechCorp" }],
      education: [{ id: "edu_1", institution: "MIT", degree: "B.S. CS" }],
    };

    const mockDocument: ResumeDocument = {
      id: "doc_1",
      fileName: "jane_developer.pdf",
      fileSizeBytes: 1024,
      mimeType: "application/pdf",
      uploadedAt: new Date().toISOString(),
      status: "parsed",
    };

    let sentFormData: FormData | null = null;
    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      sentFormData = (init?.body as FormData) ?? null;
      return new Response(
        JSON.stringify({
          success: true,
          message: "Processed 1 resume(s): 1 succeeded, 0 failed.",
          totalProcessed: 1,
          successfulCount: 1,
          failedCount: 0,
          results: [
            {
              status: "success",
              document: mockDocument,
              candidate: mockCandidate,
              warnings: [],
            },
          ],
          warnings: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    };

    const fileItem = createMockFileItem("jane_developer.pdf");
    const result = await submitScreeningResumes([fileItem], { fetchFn: mockFetch as unknown as typeof fetch });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.successfulCount).toBe(1);
    expect(result.data.failedCount).toBe(0);
    expect(result.data.candidates).toHaveLength(1);
    expect(result.data.candidates[0].fullName).toBe("Jane Developer");
    expect(result.data.candidates[0].email).toBe("jane@example.com");
    expect(result.data.candidates[0].skills).toHaveLength(2);

    // Verify multipart FormData had resumes appended
    expect(sentFormData).not.toBeNull();
    const filesInFormData = sentFormData!.getAll("resumes");
    expect(filesInFormData).toHaveLength(1);
    expect((filesInFormData[0] as File).name).toBe("jane_developer.pdf");
  });

  it("2. API failure produces a safe workflow error state", async () => {
    const mockFetch = async (): Promise<Response> => {
      return new Response(
        JSON.stringify({
          success: false,
          error: "File exceeds maximum allowed file size of 5MB.",
          code: "FILE_TOO_LARGE",
        }),
        {
          status: 413,
          headers: { "Content-Type": "application/json" },
        }
      );
    };

    const fileItem = createMockFileItem("large_resume.pdf");
    const result = await submitScreeningResumes([fileItem], { fetchFn: mockFetch as unknown as typeof fetch });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error).toBe("File exceeds maximum allowed file size of 5MB.");
    expect(result.code).toBe("FILE_TOO_LARGE");
  });

  it("3. mixed successful/failed resume results are represented correctly", async () => {
    const mockSuccessCandidate: Candidate = {
      id: "cand_valid",
      documentId: "doc_valid",
      fullName: "John Valid",
      skills: [{ name: "Python" }],
      experiences: [],
      education: [],
    };

    const mockFetch = async (): Promise<Response> => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Processed 2 resume(s): 1 succeeded, 1 failed.",
          totalProcessed: 2,
          successfulCount: 1,
          failedCount: 1,
          results: [
            {
              status: "success",
              document: {
                id: "doc_valid",
                fileName: "valid.pdf",
                fileSizeBytes: 500,
                mimeType: "application/pdf",
                uploadedAt: new Date().toISOString(),
                status: "parsed",
              },
              candidate: mockSuccessCandidate,
              warnings: ["Non-critical formatting notice"],
            },
            {
              status: "error",
              document: {
                id: "doc_corrupted",
                fileName: "corrupted.pdf",
                fileSizeBytes: 500,
                mimeType: "application/pdf",
                uploadedAt: new Date().toISOString(),
                status: "error",
                errorMessage: "Document contains unreadable binary data.",
              },
              warnings: [],
              error: "Document contains unreadable binary data.",
            },
          ],
          warnings: ["Non-critical formatting notice"],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    };

    const files = [createMockFileItem("valid.pdf"), createMockFileItem("corrupted.pdf")];
    const result = await submitScreeningResumes(files, { fetchFn: mockFetch as unknown as typeof fetch });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.totalProcessed).toBe(2);
    expect(result.data.successfulCount).toBe(1);
    expect(result.data.failedCount).toBe(1);
    expect(result.data.candidates).toHaveLength(1);
    expect(result.data.candidates[0].fullName).toBe("John Valid");
    expect(result.data.candidateResults).toHaveLength(2);

    const failedItem = result.data.candidateResults.find((r) => r.status === "error");
    expect(failedItem).toBeDefined();
    expect(failedItem!.document.fileName).toBe("corrupted.pdf");
    expect(failedItem!.error).toBe("Document contains unreadable binary data.");
    expect(result.data.warnings).toContain("Non-critical formatting notice");
  });

  it("4. empty/no-file state remains safe", async () => {
    let fetchCalled = false;
    const mockFetch = async (): Promise<Response> => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    };

    const result = await submitScreeningResumes([], { fetchFn: mockFetch as unknown as typeof fetch });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.code).toBe("NO_FILES_PROVIDED");
    expect(result.error).toBe("No resume files provided for upload.");
    expect(fetchCalled).toBe(false);
  });
});