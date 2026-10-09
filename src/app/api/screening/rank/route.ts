/**
 * Server-only execution context (Node.js runtime).
 * Candidate Ranking Route Handler.
 * Accepts structured job requirements and candidate profiles,
 * executes server-side hybrid ranking and gap analysis via RankingEngineService,
 * and returns ranked results in deterministic sorted order.
 */
import { NextRequest, NextResponse } from "next/server";
import { Candidate, RankingResult } from "@/types";
import {
  jobDescriptionProcessorService,
  ProcessedJobDescription,
} from "@/server/intelligence";
import {
  rankingEngineService,
  RankingWeightsInput,
  InvalidRankingWeightsError,
} from "@/server/matching";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ScreeningRankApiRequest {
  readonly jobDescription?: {
    readonly id?: string;
    readonly title?: string;
    readonly rawText?: string;
    readonly requiredSkills?: readonly string[];
    readonly preferredSkills?: readonly string[];
    readonly minExperienceYears?: number;
    readonly educationRequirements?: readonly string[];
  };
  readonly candidates?: readonly Candidate[];
  readonly rankingWeights?: RankingWeightsInput;
}

export interface ScreeningRankApiResponse {
  readonly success: boolean;
  readonly message?: string;
  readonly totalCandidates: number;
  readonly results: readonly RankingResult[];
  readonly jobDescription?: ProcessedJobDescription;
  readonly warnings?: readonly string[];
}

export interface ScreeningRankApiErrorResponse {
  readonly success: false;
  readonly error: string;
  readonly code?: string;
}

/**
 * Standard 405 Method Not Allowed response for unsupported HTTP verbs.
 */
function methodNotAllowedResponse(): NextResponse<ScreeningRankApiErrorResponse> {
  return NextResponse.json<ScreeningRankApiErrorResponse>(
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

export async function GET(): Promise<NextResponse<ScreeningRankApiErrorResponse>> {
  return methodNotAllowedResponse();
}

export async function PUT(): Promise<NextResponse<ScreeningRankApiErrorResponse>> {
  return methodNotAllowedResponse();
}

export async function PATCH(): Promise<NextResponse<ScreeningRankApiErrorResponse>> {
  return methodNotAllowedResponse();
}

export async function DELETE(): Promise<NextResponse<ScreeningRankApiErrorResponse>> {
  return methodNotAllowedResponse();
}

export async function POST(
  request: NextRequest | Request
): Promise<NextResponse<ScreeningRankApiResponse | ScreeningRankApiErrorResponse>> {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json<ScreeningRankApiErrorResponse>(
        {
          success: false,
          error: "Invalid request. Content-Type must be application/json.",
          code: "INVALID_CONTENT_TYPE",
        },
        { status: 400 }
      );
    }

    let body: ScreeningRankApiRequest;
    try {
      body = (await request.json()) as ScreeningRankApiRequest;
    } catch {
      return NextResponse.json<ScreeningRankApiErrorResponse>(
        {
          success: false,
          error: "Failed to parse request JSON payload.",
          code: "MALFORMED_JSON",
        },
        { status: 400 }
      );
    }

    // 1. Validate candidates array
    const candidates = Array.isArray(body?.candidates) ? body.candidates : [];
    if (candidates.length === 0) {
      return NextResponse.json<ScreeningRankApiErrorResponse>(
        {
          success: false,
          error: "No candidate profiles provided for ranking.",
          code: "NO_CANDIDATES",
        },
        { status: 400 }
      );
    }

    // 2. Validate job description input
    const jdInput = body?.jobDescription;
    const rawText = jdInput?.rawText?.trim() || "";
    const hasExplicitSkills =
      Array.isArray(jdInput?.requiredSkills) && jdInput.requiredSkills.length > 0;

    if (!rawText && !hasExplicitSkills) {
      return NextResponse.json<ScreeningRankApiErrorResponse>(
        {
          success: false,
          error: "Job description text or required skills must be provided.",
          code: "INVALID_JOB_DESCRIPTION",
        },
        { status: 400 }
      );
    }

    // 3. Process or normalize JobDescription
    let processedJob: ProcessedJobDescription;
    if (rawText.length > 0) {
      const parsed = jobDescriptionProcessorService.process({
        rawText,
        title: jdInput?.title || "Requisition",
      });

      // Merge explicit skills if provided
      const requiredSkills = Array.from(
        new Set([
          ...(jdInput?.requiredSkills ?? []),
          ...parsed.requiredSkills,
        ])
      );

      const reqLower = new Set(requiredSkills.map((s) => s.toLowerCase()));
      const preferredSkills = Array.from(
        new Set([
          ...(jdInput?.preferredSkills ?? []),
          ...parsed.preferredSkills,
        ])
      ).filter((s) => !reqLower.has(s.toLowerCase()));

      processedJob = {
        ...parsed,
        requiredSkills,
        preferredSkills,
        experienceRequirement:
          jdInput?.minExperienceYears !== undefined
            ? {
                minimumYears: jdInput.minExperienceYears,
                rawText: `${jdInput.minExperienceYears} years`,
              }
            : parsed.experienceRequirement,
        educationRequirements:
          jdInput?.educationRequirements ?? parsed.educationRequirements,
      };
    } else {
      processedJob = {
        normalizedText: "",
        characterCount: 0,
        requiredSkills: jdInput?.requiredSkills ?? [],
        preferredSkills: jdInput?.preferredSkills ?? [],
        experienceRequirement:
          jdInput?.minExperienceYears !== undefined
            ? {
                minimumYears: jdInput.minExperienceYears,
                rawText: `${jdInput.minExperienceYears} years`,
              }
            : undefined,
        educationRequirements: jdInput?.educationRequirements ?? [],
        explicitRequirements: [],
        warnings: [],
      };
    }

    // 4. Execute server-side deterministic ranking & gap analysis
    const results = await rankingEngineService.rankCandidates(
      processedJob,
      [...candidates],
      {
        rankingWeights: body?.rankingWeights,
      }
    );

    const warnings = processedJob.warnings ? [...processedJob.warnings] : [];

    return NextResponse.json<ScreeningRankApiResponse>(
      {
        success: true,
        message: `Successfully evaluated and ranked ${results.length} candidate(s).`,
        totalCandidates: results.length,
        results,
        jobDescription: processedJob,
        warnings,
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof InvalidRankingWeightsError) {
      return NextResponse.json<ScreeningRankApiErrorResponse>(
        {
          success: false,
          error: err.message,
          code: err.code,
        },
        { status: 400 }
      );
    }

    const sanitizedError =
      err instanceof Error && err.message
        ? err.message.replace(/(?:[A-Za-z]:)?(?:[\\/][a-zA-Z0-9_.-]+)+/g, "[internal-path]")
        : "An unexpected server error occurred while ranking candidates.";

    return NextResponse.json<ScreeningRankApiErrorResponse>(
      {
        success: false,
        error: sanitizedError,
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
