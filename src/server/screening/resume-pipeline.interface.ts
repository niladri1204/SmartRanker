/**
 * Server-only execution context
 * Contracts and types for the end-to-end Resume Ingestion and Processing Pipeline.
 */
import { Candidate, ResumeDocument } from "@/types";

/**
 * Standard input payload for single-resume ingestion.
 */
export interface IngestResumeInput {
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileBuffer: Buffer;
  readonly documentId?: string;
}

/**
 * Status of the resume ingestion pipeline execution.
 */
export type ResumePipelineStatus = "success" | "error";

/**
 * Result of ingesting and extracting a single resume document.
 */
export interface IngestResumeResult {
  readonly status: ResumePipelineStatus;
  readonly document: ResumeDocument;
  readonly candidate?: Candidate;
  readonly warnings: readonly string[];
  readonly error?: string;
}

/**
 * Result of ingesting a batch of resume documents.
 */
export interface BatchIngestResult {
  readonly results: readonly IngestResumeResult[];
  readonly totalProcessed: number;
  readonly successfulCount: number;
  readonly failedCount: number;
}

/**
 * Standard response shape for the HTTP resume upload API endpoint.
 */
export interface ResumeUploadApiResponse {
  readonly success: boolean;
  readonly message: string;
  readonly totalProcessed: number;
  readonly successfulCount: number;
  readonly failedCount: number;
  readonly results: readonly IngestResumeResult[];
  readonly warnings: readonly string[];
}

/**
 * Standard error response shape for the HTTP resume upload API endpoint.
 */
export interface ResumeUploadApiErrorResponse {
  readonly success: false;
  readonly error: string;
  readonly code: string;
  readonly details?: Record<string, string[]>;
}

/**
 * Contract for the server-side resume ingestion and processing pipeline.
 */
export interface IResumePipelineService {
  /**
   * Processes a single in-memory resume through document extraction,
   * text preprocessing, and candidate entity extraction.
   */
  processResume(input: IngestResumeInput): Promise<IngestResumeResult>;

  /**
   * Processes a batch of resume documents in parallel with strict failure isolation.
   */
  processBatch(inputs: readonly IngestResumeInput[]): Promise<BatchIngestResult>;
}
