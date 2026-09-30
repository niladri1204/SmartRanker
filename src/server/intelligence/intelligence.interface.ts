import { Candidate, JobDescription, ResumeDocument } from "@/types";

/**
 * Interface for parsing and structuring unstructured resume & job text
 * into rich candidate profiles and structured job requisitions.
 */
export interface ICandidateExtractor {
  /**
   * Extracts structured candidate information (skills, experience, education) from a parsed resume document.
   */
  extractCandidate(document: ResumeDocument): Promise<Candidate>;

  /**
   * Extracts structured requirements and competencies from a raw job description text.
   */
  extractJobRequirements(jobDescription: JobDescription): Promise<JobDescription>;
}
