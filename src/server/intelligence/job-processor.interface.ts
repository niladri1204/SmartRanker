/**
 * Server-only execution context
 * Contracts for job description processing and requirement extraction.
 */

/**
 * Structured representation of an experience requirement.
 */
export interface JobExperienceRequirement {
  readonly minimumYears: number;
  readonly maximumYears?: number;
  readonly rawText: string;
}

/**
 * Processed job profile containing normalized text, extracted skills,
 * experience, education, and explicit operational requirements.
 */
export interface ProcessedJobDescription {
  readonly normalizedText: string;
  readonly characterCount: number;
  readonly requiredSkills: readonly string[];
  readonly preferredSkills: readonly string[];
  readonly experienceRequirement?: JobExperienceRequirement;
  readonly educationRequirements: readonly string[];
  readonly explicitRequirements: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Input for job description processing.
 * Accepts raw job description string or an object with title and metadata.
 */
export interface ProcessJobDescriptionInput {
  readonly rawText: string;
  readonly title?: string;
  readonly department?: string;
  readonly location?: string;
}

/**
 * Service contract for deterministic job description parsing and requirement extraction.
 */
export interface IJobDescriptionProcessor {
  process(input: ProcessJobDescriptionInput | string): ProcessedJobDescription;
}
