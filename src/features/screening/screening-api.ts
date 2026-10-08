import { Candidate, RankingResult, ResumeDocument } from "@/types";
import type { ProcessedJobDescription } from "@/server/intelligence";
import { CandidateProcessingResult, UploadedFileItem } from "./types";
import { RankingWeightsInput } from "@/server/matching";

export interface ScreeningApiSuccessData {
  readonly success: boolean;
  readonly message?: string;
  readonly totalProcessed: number;
  readonly successfulCount: number;
  readonly failedCount: number;
  readonly candidates: readonly Candidate[];
  readonly candidateResults: readonly CandidateProcessingResult[];
  readonly warnings: readonly string[];
}

export type ScreeningApiResponse =
  | { readonly ok: true; readonly data: ScreeningApiSuccessData }
  | { readonly ok: false; readonly error: string; readonly code?: string };

export interface ScreeningRankApiRequest {
  readonly jobDescription: {
    readonly id?: string;
    readonly title?: string;
    readonly rawText: string;
    readonly requiredSkills?: readonly string[];
    readonly preferredSkills?: readonly string[];
    readonly minExperienceYears?: number;
    readonly educationRequirements?: readonly string[];
  };
  readonly candidates: readonly Candidate[];
  readonly rankingWeights?: RankingWeightsInput;
}

export interface ScreeningRankApiSuccessData {
  readonly success: boolean;
  readonly message?: string;
  readonly totalCandidates: number;
  readonly results: readonly RankingResult[];
  readonly jobDescription?: ProcessedJobDescription;
  readonly warnings?: readonly string[];
}

export type ScreeningRankApiResponse =
  | { readonly ok: true; readonly data: ScreeningRankApiSuccessData }
  | { readonly ok: false; readonly error: string; readonly code?: string };

export interface ScreeningApiOptions {
  readonly fetchFn?: typeof fetch;
  readonly endpoint?: string;
}

/**
 * Dispatches uploaded resume files to the backend screening upload API.
 * Uses browser-native FormData and fetch without third-party HTTP libraries.
 * Does not expose raw file contents in URLs or browser storage.
 */
export async function submitScreeningResumes(
  files: readonly (UploadedFileItem | File)[],
  options: ScreeningApiOptions = {}
): Promise<ScreeningApiResponse> {
  if (!files || files.length === 0) {
    return {
      ok: false,
      error: "No resume files provided for upload.",
      code: "NO_FILES_PROVIDED",
    };
  }

  const fetchFn = options.fetchFn ?? fetch;
  const endpoint = options.endpoint ?? "/api/screening/resumes";

  const formData = new FormData();
  for (const item of files) {
    const rawFile = "file" in item ? item.file : item;
    if (rawFile instanceof File) {
      formData.append("resumes", rawFile, rawFile.name);
    }
  }

  try {
    const response = await fetchFn(endpoint, {
      method: "POST",
      body: formData,
    });

    let json: Record<string, unknown> | null = null;
    try {
      json = (await response.json()) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        error: `Server returned status ${response.status} with an unreadable response format.`,
        code: "INVALID_JSON_RESPONSE",
      };
    }

    if (!response.ok || !json) {
      const errorMsg =
        typeof json?.error === "string"
          ? json.error
          : `Upload failed with HTTP status ${response.status}.`;
      const code = typeof json?.code === "string" ? json.code : undefined;
      return {
        ok: false,
        error: errorMsg,
        code,
      };
    }

    const rawResults = Array.isArray(json.results) ? json.results : [];
    const candidateResults: CandidateProcessingResult[] = rawResults.map(
      (r: Record<string, unknown>, index: number) => {
        const doc = (r.document ?? {}) as ResumeDocument;
        const isSuccess = r.status === "success";
        return {
          status: isSuccess ? "success" : "error",
          document: {
            id: typeof doc.id === "string" ? doc.id : `doc_${index}_${Date.now()}`,
            fileName: typeof doc.fileName === "string" ? doc.fileName : "Unknown Document",
            fileSizeBytes: typeof doc.fileSizeBytes === "number" ? doc.fileSizeBytes : 0,
            mimeType: typeof doc.mimeType === "string" ? doc.mimeType : "application/octet-stream",
            uploadedAt: typeof doc.uploadedAt === "string" ? doc.uploadedAt : new Date().toISOString(),
            status: isSuccess ? "parsed" : "error",
            errorMessage: typeof r.error === "string" ? r.error : doc.errorMessage,
          },
          candidate: (r.candidate as Candidate | undefined) ?? undefined,
          warnings: Array.isArray(r.warnings) ? (r.warnings as string[]) : [],
          error: typeof r.error === "string" ? r.error : undefined,
        };
      }
    );

    const candidates = candidateResults
      .filter((r) => r.status === "success" && r.candidate)
      .map((r) => r.candidate as Candidate);

    const warnings = Array.isArray(json.warnings)
      ? (json.warnings as string[])
      : candidateResults.flatMap((r) => r.warnings);

    const successfulCount =
      typeof json.successfulCount === "number"
        ? json.successfulCount
        : candidates.length;
    const failedCount =
      typeof json.failedCount === "number"
        ? json.failedCount
        : candidateResults.length - candidates.length;
    const totalProcessed =
      typeof json.totalProcessed === "number"
        ? json.totalProcessed
        : candidateResults.length;

    return {
      ok: true,
      data: {
        success: Boolean(json.success),
        message: typeof json.message === "string" ? json.message : undefined,
        totalProcessed,
        successfulCount,
        failedCount,
        candidates,
        candidateResults,
        warnings,
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Network error occurred while uploading resumes.";
    return {
      ok: false,
      error: message,
      code: "NETWORK_ERROR",
    };
  }
}

/**
 * Dispatches candidate profiles and job requisition to the server-side ranking API.
 * Returns ranked results in deterministic sort order with match gap analysis.
 */
export async function rankScreeningCandidates(
  request: ScreeningRankApiRequest,
  options: ScreeningApiOptions = {}
): Promise<ScreeningRankApiResponse> {
  if (!request.candidates || request.candidates.length === 0) {
    return {
      ok: false,
      error: "No candidate profiles provided for ranking.",
      code: "NO_CANDIDATES",
    };
  }

  const fetchFn = options.fetchFn ?? fetch;
  const endpoint = options.endpoint ?? "/api/screening/rank";

  try {
    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    let json: Record<string, unknown> | null = null;
    try {
      json = (await response.json()) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        error: `Server returned status ${response.status} with an unreadable response format.`,
        code: "INVALID_JSON_RESPONSE",
      };
    }

    if (!response.ok || !json) {
      const errorMsg =
        typeof json?.error === "string"
          ? json.error
          : `Ranking failed with HTTP status ${response.status}.`;
      const code = typeof json?.code === "string" ? json.code : undefined;
      return {
        ok: false,
        error: errorMsg,
        code,
      };
    }

    const rawResults = Array.isArray(json.results) ? (json.results as RankingResult[]) : [];
    const totalCandidates =
      typeof json.totalCandidates === "number" ? json.totalCandidates : rawResults.length;

    return {
      ok: true,
      data: {
        success: Boolean(json.success),
        message: typeof json.message === "string" ? json.message : undefined,
        totalCandidates,
        results: rawResults,
        jobDescription: json.jobDescription as ProcessedJobDescription | undefined,
        warnings: Array.isArray(json.warnings) ? (json.warnings as string[]) : [],
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Network error occurred while ranking candidates.";
    return {
      ok: false,
      error: message,
      code: "NETWORK_ERROR",
    };
  }
}
