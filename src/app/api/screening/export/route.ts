/**
 * Server-only execution context (Node.js runtime).
 * Candidate Ranking Export Route Handler.
 * Accepts structured ranking results and job title,
 * formats into downloadable CSV or PDF reports, and returns with appropriate attachment headers.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  exportService,
  ExportFormat,
  ExportError,
  InvalidExportInputError,
} from "@/server/export";
import { RankingResult } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ScreeningExportApiRequest {
  readonly format?: ExportFormat;
  readonly jobTitle?: string;
  readonly rankingResults?: readonly RankingResult[];
}

export interface ScreeningExportApiErrorResponse {
  readonly success: false;
  readonly error: string;
  readonly code?: string;
}

/**
 * Standard 405 Method Not Allowed response for unsupported HTTP verbs.
 */
function methodNotAllowedResponse(): NextResponse<ScreeningExportApiErrorResponse> {
  return NextResponse.json<ScreeningExportApiErrorResponse>(
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

export async function GET(): Promise<NextResponse<ScreeningExportApiErrorResponse>> {
  return methodNotAllowedResponse();
}

export async function PUT(): Promise<NextResponse<ScreeningExportApiErrorResponse>> {
  return methodNotAllowedResponse();
}

export async function PATCH(): Promise<NextResponse<ScreeningExportApiErrorResponse>> {
  return methodNotAllowedResponse();
}

export async function DELETE(): Promise<NextResponse<ScreeningExportApiErrorResponse>> {
  return methodNotAllowedResponse();
}

export async function POST(
  request: NextRequest | Request
): Promise<Response> {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json<ScreeningExportApiErrorResponse>(
        {
          success: false,
          error: "Invalid request. Content-Type must be application/json.",
          code: "INVALID_CONTENT_TYPE",
        },
        { status: 400 }
      );
    }

    let body: ScreeningExportApiRequest;
    try {
      body = (await request.json()) as ScreeningExportApiRequest;
    } catch {
      return NextResponse.json<ScreeningExportApiErrorResponse>(
        {
          success: false,
          error: "Failed to parse request JSON payload.",
          code: "MALFORMED_JSON",
        },
        { status: 400 }
      );
    }

    const { format, jobTitle, rankingResults } = body ?? {};

    if (!format || (format !== "csv" && format !== "pdf")) {
      return NextResponse.json<ScreeningExportApiErrorResponse>(
        {
          success: false,
          error: "Invalid or missing format. Supported formats: 'csv', 'pdf'.",
          code: "INVALID_FORMAT",
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(rankingResults) || rankingResults.length === 0) {
      return NextResponse.json<ScreeningExportApiErrorResponse>(
        {
          success: false,
          error: "No candidate ranking results provided for export.",
          code: "NO_RANKING_RESULTS",
        },
        { status: 400 }
      );
    }

    const exportResult = await exportService.exportResults({
      format,
      jobTitle: typeof jobTitle === "string" ? jobTitle.trim() : undefined,
      rankingResults,
    });

    return new Response(new Uint8Array(exportResult.data), {
      status: 200,
      headers: {
        "Content-Type": exportResult.mimeType,
        "Content-Disposition": `attachment; filename="${exportResult.filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (err) {
    if (err instanceof InvalidExportInputError) {
      return NextResponse.json<ScreeningExportApiErrorResponse>(
        {
          success: false,
          error: err.message,
          code: err.code,
        },
        { status: 400 }
      );
    }

    if (err instanceof ExportError) {
      return NextResponse.json<ScreeningExportApiErrorResponse>(
        {
          success: false,
          error: err.message,
          code: err.code,
        },
        { status: err.statusCode }
      );
    }

    const sanitizedError =
      err instanceof Error && err.message
        ? err.message.replace(/(?:[A-Za-z]:)?(?:[\\/][a-zA-Z0-9_.-]+)+/g, "[internal-path]")
        : "An unexpected server error occurred while generating the export.";

    return NextResponse.json<ScreeningExportApiErrorResponse>(
      {
        success: false,
        error: sanitizedError,
        code: "EXPORT_SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
