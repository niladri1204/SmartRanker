import { Candidate, RankingResult, RankingWeights, ResumeDocument } from "@/types";

export const DEFAULT_FRONTEND_RANKING_WEIGHTS: RankingWeights = Object.freeze({
  requiredSkillsWeight: 40,
  semanticSimilarityWeight: 25,
  experienceWeight: 20,
  preferredSkillsWeight: 10,
  educationWeight: 5,
});

export interface UploadedFileItem {
  readonly id: string;
  readonly file: File;
  readonly name: string;
  readonly size: number;
  readonly type: string;
  readonly status: "ready" | "invalid" | "processing" | "error";
  readonly errorMessage?: string;
  readonly uploadedAt: string;
}

export interface CandidateProcessingResult {
  readonly status: "success" | "error";
  readonly document: ResumeDocument;
  readonly candidate?: Candidate;
  readonly warnings: readonly string[];
  readonly error?: string;
}

export type ExportFormat = "csv" | "pdf";

export interface ScreeningWorkflowState {
  readonly jobTitle: string;
  readonly jobDescriptionText: string;
  readonly files: readonly UploadedFileItem[];
  readonly isEvaluating: boolean;
  readonly isReRanking: boolean;
  readonly isExporting: boolean;
  readonly exportingFormat: ExportFormat | null;
  readonly results: readonly RankingResult[];
  readonly candidates: readonly Candidate[];
  readonly candidateResults: readonly CandidateProcessingResult[];
  readonly warnings: readonly string[];
  readonly generalError: string | null;
  readonly exportError: string | null;
  readonly validationErrors: {
    readonly jobDescription?: string;
    readonly files?: string;
    readonly weights?: string;
  };
  readonly rankingWeights: RankingWeights;
  readonly appliedWeights?: RankingWeights;
}

export type ScreeningTab = "editor" | "resumes" | "results";
