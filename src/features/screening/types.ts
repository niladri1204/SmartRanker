import { RankingResult } from "@/types";

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

export interface ScreeningWorkflowState {
  readonly jobTitle: string;
  readonly jobDescriptionText: string;
  readonly files: readonly UploadedFileItem[];
  readonly isEvaluating: boolean;
  readonly results: readonly RankingResult[];
  readonly generalError: string | null;
  readonly validationErrors: {
    readonly jobDescription?: string;
    readonly files?: string;
  };
}

export type ScreeningTab = "editor" | "resumes" | "results";
