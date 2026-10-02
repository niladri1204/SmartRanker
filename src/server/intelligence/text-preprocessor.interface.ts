/**
 * Server-only execution context
 * Contracts for resume text preprocessing and normalization.
 */

/**
 * Standard input payload for resume text preprocessing.
 */
export interface PreprocessTextInput {
  readonly rawText: string;
  readonly documentId?: string;
}

/**
 * Normalized output produced by the resume text preprocessing service.
 * Contains cleaned text, character count, extracted contacts, and warnings.
 */
export interface PreprocessedResumeOutput {
  readonly normalizedText: string;
  readonly characterCount: number;
  readonly emails: readonly string[];
  readonly phoneNumbers: readonly string[];
  readonly urls: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Service contract for deterministic resume text preprocessing and contact extraction.
 */
export interface IResumeTextPreprocessor {
  /**
   * Preprocesses raw extracted document text into clean, normalized text
   * and extracts contact details (emails, phone numbers, URLs).
   */
  preprocess(input: PreprocessTextInput | string): PreprocessedResumeOutput;
}
