/**
 * Server-only execution context
 * End-to-end Resume Ingestion and Processing Pipeline Service.
 * Orchestrates:
 *   1. In-memory buffer validation & input preparation
 *   2. Document parsing (PDF & DOCX text extraction)
 *   3. Deterministic resume text preprocessing & normalization
 *   4. Domain entity construction (ResumeDocument)
 *   5. Structured candidate profile extraction (Candidate)
 *   6. Isolated per-file batch processing
 */
import { Candidate, ResumeDocument } from "@/types";
import {
  CompositeDocumentParserService,
  createDocumentParseInput,
  DocumentParseInput,
  documentParserService,
  ParsedDocumentOutput,
  sanitizeFileName,
} from "../documents";
import {
  CandidateExtractorService,
  candidateExtractorService,
  resumeTextPreprocessorService,
  ResumeTextPreprocessorService,
} from "../intelligence";
import {
  BatchIngestResult,
  IngestResumeInput,
  IngestResumeResult,
  IResumePipelineService,
} from "./resume-pipeline.interface";

export class ResumePipelineService implements IResumePipelineService {
  constructor(
    private readonly documentParser: CompositeDocumentParserService = documentParserService,
    private readonly textPreprocessor: ResumeTextPreprocessorService = resumeTextPreprocessorService,
    private readonly candidateExtractor: CandidateExtractorService = candidateExtractorService
  ) {}

  /**
   * Sanitizes an error message to prevent leaking internal filesystem paths or stack traces.
   */
  private sanitizeErrorMessage(err: unknown, fallbackMessage: string): string {
    if (err instanceof Error && err.message) {
      const sanitized = err.message
        .replace(/(?:[A-Za-z]:)?(?:[\\/][a-zA-Z0-9_.\-]+)+/g, "[internal-path]")
        .trim();
      return sanitized || fallbackMessage;
    }
    return fallbackMessage;
  }

  /**
   * Generates a safe, unique document ID if not explicitly provided.
   */
  private generateDocumentId(prefix = "doc"): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Processes a single in-memory resume through document extraction,
   * text preprocessing, and candidate entity extraction.
   */
  public async processResume(
    input: IngestResumeInput
  ): Promise<IngestResumeResult> {
    const documentId = input.documentId ?? this.generateDocumentId();
    const uploadedAt = new Date().toISOString();
    const accumulatedWarnings: string[] = [];

    // Step 1: Input validation and DocumentParseInput factory
    let parseInput: DocumentParseInput;
    try {
      parseInput = createDocumentParseInput({
        fileName: input.fileName,
        mimeType: input.mimeType,
        buffer: input.fileBuffer,
      });
    } catch (err) {
      const errorMessage = this.sanitizeErrorMessage(
        err,
        `Validation failed for document "${input.fileName}".`
      );
      const errorDoc: ResumeDocument = {
        id: documentId,
        fileName: sanitizeFileName(input.fileName || "untitled_document"),
        fileSizeBytes: input.fileBuffer?.byteLength ?? 0,
        mimeType: input.mimeType || "application/octet-stream",
        uploadedAt,
        status: "error",
        errorMessage,
      };

      return {
        status: "error",
        document: errorDoc,
        warnings: [],
        error: errorMessage,
      };
    }

    // Step 2: Document parsing (PDF / DOCX text extraction)
    let parsedOutput: ParsedDocumentOutput;
    try {
      parsedOutput = await this.documentParser.parseDocument(parseInput);
      if (parsedOutput.warnings && parsedOutput.warnings.length > 0) {
        accumulatedWarnings.push(...parsedOutput.warnings);
      }
    } catch (err) {
      const errorMessage = this.sanitizeErrorMessage(
        err,
        `Failed to parse document "${parseInput.fileName}".`
      );
      const errorDoc: ResumeDocument = {
        id: documentId,
        fileName: parseInput.fileName,
        fileSizeBytes: parseInput.byteSize,
        mimeType: parseInput.mimeType,
        uploadedAt,
        status: "error",
        errorMessage,
      };

      return {
        status: "error",
        document: errorDoc,
        warnings: accumulatedWarnings,
        error: errorMessage,
      };
    }

    // Step 3: Resume text preprocessing & contact extraction
    const preprocessed = this.textPreprocessor.preprocess(parsedOutput.rawText);
    if (preprocessed.warnings && preprocessed.warnings.length > 0) {
      accumulatedWarnings.push(...preprocessed.warnings);
    }

    // Step 4: Create typed ResumeDocument domain entity
    const resumeDocument: ResumeDocument = {
      id: documentId,
      fileName: parseInput.fileName,
      fileSizeBytes: parseInput.byteSize,
      mimeType: parseInput.mimeType,
      uploadedAt,
      rawText: preprocessed.normalizedText,
      status: "parsed",
    };

    // Step 5: Candidate profile extraction
    let candidate: Candidate;
    try {
      candidate = await this.candidateExtractor.extractCandidate(resumeDocument);
    } catch (err) {
      const errorMessage = this.sanitizeErrorMessage(
        err,
        `Candidate attribute extraction failed for "${parseInput.fileName}".`
      );
      const failedDoc: ResumeDocument = {
        ...resumeDocument,
        status: "error",
        errorMessage,
      };

      return {
        status: "error",
        document: failedDoc,
        warnings: accumulatedWarnings,
        error: errorMessage,
      };
    }

    // Step 6: Return unified success result
    return {
      status: "success",
      document: resumeDocument,
      candidate,
      warnings: accumulatedWarnings,
    };
  }

  /**
   * Processes a batch of resume documents in parallel with strict failure isolation.
   * A failure in one document will not affect the processing of any other documents.
   */
  public async processBatch(
    inputs: readonly IngestResumeInput[]
  ): Promise<BatchIngestResult> {
    if (!inputs || inputs.length === 0) {
      return {
        results: [],
        totalProcessed: 0,
        successfulCount: 0,
        failedCount: 0,
      };
    }

    const results = await Promise.all(
      inputs.map(async (input) => {
        try {
          return await this.processResume(input);
        } catch (unhandledErr) {
          // Absolute fallback guard to guarantee no batch crash
          const fallbackId = input.documentId ?? this.generateDocumentId();
          const fallbackDoc: ResumeDocument = {
            id: fallbackId,
            fileName: sanitizeFileName(input.fileName || "untitled_document"),
            fileSizeBytes: input.fileBuffer?.byteLength ?? 0,
            mimeType: input.mimeType || "application/octet-stream",
            uploadedAt: new Date().toISOString(),
            status: "error",
            errorMessage: this.sanitizeErrorMessage(
              unhandledErr,
              "Unexpected internal processing failure."
            ),
          };

          return {
            status: "error" as const,
            document: fallbackDoc,
            warnings: [],
            error: fallbackDoc.errorMessage,
          };
        }
      })
    );

    const successfulCount = results.filter((r) => r.status === "success").length;
    const failedCount = results.length - successfulCount;

    return {
      results,
      totalProcessed: results.length,
      successfulCount,
      failedCount,
    };
  }
}

export const resumePipelineService = new ResumePipelineService();
