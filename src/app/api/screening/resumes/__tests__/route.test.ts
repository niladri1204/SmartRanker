import { describe, it, expect } from "vitest";
import { POST, GET, PUT, DELETE } from "../route";
import {
  ResumeUploadApiResponse,
  ResumeUploadApiErrorResponse,
} from "@/server/screening";

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
 * Embeds text: "John Doe Lead Developer\nExperienced TypeScript Architect"
 */
const SAMPLE_VALID_DOCX = Buffer.from(
  "UEsDBAoAAAAAAEt5Ql15bjPXrQEAAK0BAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz48VHlwZXMgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9wYWNrYWdlLzIwMDYvY29udGVudC10eXBlcyI+PERlZmF1bHQgRXh0ZW5zaW9uPSJyZWxzIiBDb250ZW50VHlwZT0iYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLXBhY2thZ2UucmVsYXRpb25zaGlwcyt4bWwiLz48RGVmYXVsdCBFeHRlbnNpb249InhtbCIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3htbCIvPjxPdmVycmlkZSBQYXJ0TmFtZT0iL3dvcmQvZG9jdW1lbnQueG1sIiBDb250ZW50VHlwZT0iYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LndvcmRwcm9jZXNzaW5nbWwuZG9jdW1lbnQubWFpbit4bWwiLz48L1R5cGVzPlBLAwQKAAAAAABLeUJdAAAAAAAAAAAAAAAABgAAAF9yZWxzL1BLAwQKAAAAAABLeUJdm/036ikBAAApAQAACwAAAF9yZWxzLy5yZWxzPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/PjxSZWxhdGlvbnNoaXBzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L3JlbGF0aW9uc2hpcHMiPjxSZWxhdGlvbnNoaXAgSWQ9InJJZDEiIFR5cGU9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L3JlbGF0aW9uc2hpcHMvb2ZmaWNlRG9jdW1lbnQiIFRhcmdldD0id29yZC9kb2N1bWVudC54bWwiLz48L1JlbGF0aW9uc2hpcHM+UEsDBAoAAAAAAEt5Ql0AAAAAAAAAAAAAAAAFAAAAd29yZC9QSwMECgAAAAAAS3lCXRoydmQhAQAAIQEAABEAAAB3b3JkL2RvY3VtZW50LnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz48dzpkb2N1bWVudCB4bWxuczp3PSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvd29yZHByb2Nlc3NpbmdtbC8yMDA2L21haW4iPjx3OmJvZHk+PHc6cD48dzpyPjx3OnQ+Sm9obiBEb2UgTGVhZCBEZXZlbG9wZXI8L3c6dD48L3c6cj48L3c6cD48dzpwPjx3OnI+PHc6dD5FeHBlcmllbmNlZCBUeXBlU2NyaXB0IEFyY2hpdGVjdDwvdzp0PjwvdzpyPjwvdzpwPjwvdzpib2R5Pjwvdzpkb2N1bWVudD5QSwECFAAKAAAAAABLeUJdeW4z160BAACtAQAAEwAAAAAAAAAAAAAAAAAAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQIUAAoAAAAAAEt5Ql0AAAAAAAAAAAAAAAAGAAAAAAAAAAAAEAAAAN4BAABfcmVscy9QSwECFAAKAAAAAABLeUJdm/036ikBAAApAQAACwAAAAAAAAAAAAAAAAACAgAAX3JlbHMvLnJlbHNQSwECFAAKAAAAAABLeUJdAAAAAAAAAAAAAAAABQAAAAAAAAAAABAAAABUAwAAd29yZC9QSwECFAAKAAAAAABLeUJdGjJ2ZCEBAAAhAQAAEQAAAAAAAAAAAAAAAAB3AwAAd29yZC9kb2N1bWVudC54bWxQSwUGAAAAAAUABQAgAQAAxwQAAAAA",
  "base64"
);

describe("POST /api/screening/resumes Route Handler", () => {
  it("should process a valid multipart upload with a supported PDF and return structured candidate result", async () => {
    const formData = new FormData();
    const file = new File([SAMPLE_VALID_PDF], "jane_doe_resume.pdf", {
      type: "application/pdf",
    });
    formData.append("resumes", file);

    const request = new Request("http://localhost:3000/api/screening/resumes", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = (await response.json()) as ResumeUploadApiResponse;
    expect(body.success).toBe(true);
    expect(body.totalProcessed).toBe(1);
    expect(body.successfulCount).toBe(1);
    expect(body.failedCount).toBe(0);
    expect(body.results).toHaveLength(1);

    const result = body.results[0];
    expect(result.status).toBe("success");
    expect(result.document.fileName).toBe("jane_doe_resume.pdf");
    expect(result.document.status).toBe("parsed");
    expect(result.candidate?.fullName).toBe("Jane Doe");
  });

  it("should process a valid DOCX upload and return candidate data with detected skills", async () => {
    const formData = new FormData();
    const file = new File([SAMPLE_VALID_DOCX], "john_doe_resume.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    formData.append("resumes", file);

    const request = new Request("http://localhost:3000/api/screening/resumes", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = (await response.json()) as ResumeUploadApiResponse;
    expect(body.success).toBe(true);
    expect(body.results).toHaveLength(1);

    const result = body.results[0];
    expect(result.status).toBe("success");
    expect(result.candidate?.fullName).toBe("John Doe");
    expect(result.candidate?.skills.some((s) => s.name === "TypeScript")).toBe(true);
  });

  it("should reject non-multipart or unsupported file formats with status 400", async () => {
    // 1. Non-multipart Content-Type
    const nonMultipartReq = new Request(
      "http://localhost:3000/api/screening/resumes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "not multipart" }),
      }
    );
    const nonMultipartRes = await POST(nonMultipartReq);
    expect(nonMultipartRes.status).toBe(400);
    const nonMultipartBody =
      (await nonMultipartRes.json()) as ResumeUploadApiErrorResponse;
    expect(nonMultipartBody.code).toBe("INVALID_CONTENT_TYPE");

    // 2. Unsupported file type (.txt / plain text)
    const formData = new FormData();
    const textFile = new File(["Plain text resume notes"], "notes.txt", {
      type: "text/plain",
    });
    formData.append("resumes", textFile);

    const textReq = new Request("http://localhost:3000/api/screening/resumes", {
      method: "POST",
      body: formData,
    });
    const textRes = await POST(textReq);
    expect(textRes.status).toBe(400);
    const textBody = (await textRes.json()) as ResumeUploadApiErrorResponse;
    expect(textBody.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(textBody.error).toContain("Unsupported file format");
  });

  it("should enforce missing input (400) and batch limit (413) constraints", async () => {
    // 1. Missing files (empty FormData)
    const emptyFormData = new FormData();
    const emptyReq = new Request(
      "http://localhost:3000/api/screening/resumes",
      {
        method: "POST",
        body: emptyFormData,
      }
    );
    const emptyRes = await POST(emptyReq);
    expect(emptyRes.status).toBe(400);
    const emptyBody = (await emptyRes.json()) as ResumeUploadApiErrorResponse;
    expect(emptyBody.code).toBe("NO_FILES_PROVIDED");

    // 2. Exceeded batch limit (26 files > 25 limit)
    const oversizedFormData = new FormData();
    for (let i = 0; i < 26; i++) {
      const dummyPdf = new File(
        [SAMPLE_VALID_PDF],
        `candidate_${i + 1}.pdf`,
        { type: "application/pdf" }
      );
      oversizedFormData.append("resumes", dummyPdf);
    }
    const oversizedReq = new Request(
      "http://localhost:3000/api/screening/resumes",
      {
        method: "POST",
        body: oversizedFormData,
      }
    );
    const oversizedRes = await POST(oversizedReq);
    expect(oversizedRes.status).toBe(413);
    const oversizedBody =
      (await oversizedRes.json()) as ResumeUploadApiErrorResponse;
    expect(oversizedBody.code).toBe("BATCH_LIMIT_EXCEEDED");
    expect(oversizedBody.error).toContain("Exceeded maximum batch limit");
  });

  it("should return 405 Method Not Allowed for non-POST HTTP methods", async () => {
    const getRes = await GET();
    expect(getRes.status).toBe(405);
    expect(getRes.headers.get("Allow")).toBe("POST");

    const putRes = await PUT();
    expect(putRes.status).toBe(405);

    const deleteRes = await DELETE();
    expect(deleteRes.status).toBe(405);
  });
});
