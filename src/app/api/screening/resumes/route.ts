/**
 * Server-only execution context (Node.js runtime).
 * Resume Upload Route Handler.
 * Accepts multipart/form-data with resume files, validates size and format limits,
 * and delegates processing to the server-side ResumePipelineService.
 */
import { NextRequest, NextResponse } from "next/server";
import { envConfig } from "@/config/env";
import { detectDocumentFormat } from "@/server/documents";
import {
  IngestResumeInput,
  resumePipelineService,
  ResumeUploadApiErrorResponse,
  ResumeUploadApiResponse,
} from "@/server/screening";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Standard 405 Method Not Allowed response for unsupported HTTP verbs.
 */
function methodNotAllowedResponse(): NextResponse<ResumeUploadApiErrorResponse> {
  return NextResponse.json<ResumeUploadApiErrorResponse>(
    {
      success: false,
      error: "Method not allowed. Only POST requests are supported.",
      code: "METHOD_NOT_ALLOWED",
    },
    {
      status: 405,
      headers: {
        Allow: "POST",
      },
    }
  );
}

export async function GET(): Promise<NextResponse<ResumeUploadApiErrorResponse>> {
  return methodNotAllowedResponse();
}

export async function PUT(): Promise<NextResponse<ResumeUploadApiErrorResponse>> {
  return methodNotAllowedResponse();
}

export async function PATCH(): Promise<NextResponse<ResumeUploadApiErrorResponse>> {
  return methodNotAllowedResponse();
}

export async function DELETE(): Promise<NextResponse<ResumeUploadApiErrorResponse>> {
  return methodNotAllowedResponse();
}

export async function POST(
  request: NextRequest | Request
): Promise<NextResponse<ResumeUploadApiResponse | ResumeUploadApiErrorResponse>> {
  try {
    const contentType = request.headers.get("content-type") || "";

    // 1. Verify content-type is multipart/form-data
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json<ResumeUploadApiErrorResponse>(
        {
          success: false,
          error: "Invalid request. Content-Type must be multipart/form-data.",
          code: "INVALID_CONTENT_TYPE",
        },
        { status: 400 }
      );
    }

    // 2. Parse incoming FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json<ResumeUploadApiErrorResponse>(
        {
          success: false,
          error: "Failed to parse multipart form data payload.",
          code: "MALFORMED_FORM_DATA",
        },
        { status: 400 }
      );
    }

    // 3. Extract uploaded files from "resumes" (or fallback "resume")
    let uploadedEntries = formData.getAll("resumes");
    if (uploadedEntries.length === 0) {
      uploadedEntries = formData.getAll("resume");
    }

    const files = uploadedEntries.filter(
      (entry): entry is File => entry instanceof File && typeof entry.name === "string"
    );

    if (files.length === 0) {
      return NextResponse.json<ResumeUploadApiErrorResponse>(
        {
          success: false,
          error: "No resume files provided. Expected field 'resumes'.",
          code: "NO_FILES_PROVIDED",
        },
        { status: 400 }
      );
    }

    // 4. Validate batch count limit
    if (files.length > envConfig.maxResumeFiles) {
      return NextResponse.json<ResumeUploadApiErrorResponse>(
        {
          success: false,
          error: `Exceeded maximum batch limit of ${envConfig.maxResumeFiles} resumes. Received ${files.length}.`,
          code: "BATCH_LIMIT_EXCEEDED",
        },
        { status: 413 }
      );
    }

    // 5. Validate individual files (non-empty, max size, supported format)
    for (const file of files) {
      if (file.size === 0) {
        return NextResponse.json<ResumeUploadApiErrorResponse>(
          {
            success: false,
            error: `File "${file.name}" is empty (0 bytes).`,
            code: "EMPTY_FILE",
          },
          { status: 400 }
        );
      }

      if (file.size > envConfig.maxUploadSizeBytes) {
        const maxMb = envConfig.maxUploadSizeBytes / (1024 * 1024);
        return NextResponse.json<ResumeUploadApiErrorResponse>(
          {
            success: false,
            error: `File "${file.name}" exceeds maximum allowed file size of ${maxMb}MB.`,
            code: "FILE_TOO_LARGE",
          },
          { status: 413 }
        );
      }

      const format = detectDocumentFormat(file.name, file.type);
      if (format !== "pdf" && format !== "docx") {
        return NextResponse.json<ResumeUploadApiErrorResponse>(
          {
            success: false,
            error: `Unsupported file format for "${file.name}". Only PDF (.pdf) and DOCX (.docx) documents are supported.`,
            code: "UNSUPPORTED_MEDIA_TYPE",
          },
          { status: 400 }
        );
      }
    }

    // 6. In-memory buffer conversion without writing to disk
    const pipelineInputs: IngestResumeInput[] = [];
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);
      const isPdf = file.name.toLowerCase().endsWith(".pdf");
      const defaultMime = isPdf
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      pipelineInputs.push({
        fileName: file.name,
        mimeType: file.type || defaultMime,
        fileBuffer,
      });
    }

    // 7. Dispatch to ResumePipelineService with failure isolation
    const batchResult = await resumePipelineService.processBatch(pipelineInputs);
    const allWarnings = batchResult.results.flatMap((r) => r.warnings);

    // 8. Return strongly typed JSON serializable response
    return NextResponse.json<ResumeUploadApiResponse>(
      {
        success: batchResult.successfulCount > 0,
        message: `Processed ${batchResult.totalProcessed} resume(s): ${batchResult.successfulCount} succeeded, ${batchResult.failedCount} failed.`,
        totalProcessed: batchResult.totalProcessed,
        successfulCount: batchResult.successfulCount,
        failedCount: batchResult.failedCount,
        results: batchResult.results,
        warnings: allWarnings,
      },
      { status: 200 }
    );
  } catch (err) {
    // Sanitize surfaced error messages
    const sanitizedError =
      err instanceof Error && err.message
        ? err.message.replace(/(?:[A-Za-z]:)?(?:[\\/][a-zA-Z0-9_.\-]+)+/g, "[internal-path]")
        : "An unexpected server error occurred while processing resumes.";

    return NextResponse.json<ResumeUploadApiErrorResponse>(
      {
        success: false,
        error: sanitizedError,
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
