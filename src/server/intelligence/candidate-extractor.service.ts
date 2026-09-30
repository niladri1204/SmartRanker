/**
 * Server-only execution context
 */
import { Candidate, JobDescription, ResumeDocument } from "@/types";
import { ICandidateExtractor } from "./intelligence.interface";
import { ExtractionError } from "@/lib/errors";

/**
 * Candidate Profile Extractor Service Stub.
 * Foundation for candidate attribute extraction (Phase 2).
 */
export class CandidateExtractorService implements ICandidateExtractor {
  public async extractCandidate(document: ResumeDocument): Promise<Candidate> {
    if (!document.rawText && document.status !== "parsed") {
      throw new ExtractionError(
        `Cannot extract candidate from unparsed document: ${document.fileName}`
      );
    }

    // Phase 2 will plug in candidate profiling and entity recognition
    return {
      id: `cand_${document.id}`,
      documentId: document.id,
      fullName: document.fileName.replace(/\.[^/.]+$/, ""),
      skills: [],
      experiences: [],
      education: [],
    };
  }

  public async extractJobRequirements(
    jobDescription: JobDescription
  ): Promise<JobDescription> {
    // Phase 2 will plug in job requirement extraction
    return {
      ...jobDescription,
      requiredSkills: jobDescription.requiredSkills ?? [],
      preferredSkills: jobDescription.preferredSkills ?? [],
    };
  }
}

export const candidateExtractorService = new CandidateExtractorService();
