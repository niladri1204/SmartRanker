/**
 * Server-only execution context
 */
import { Candidate, JobDescription, ResumeDocument } from "@/types";
import { ICandidateExtractor } from "./intelligence.interface";
import { ExtractionError } from "@/lib/errors";
import { jobDescriptionProcessorService } from "./job-description-processor.service";

/**
 * Candidate Profile Extractor Service.
 * Foundation for candidate attribute and job requirement extraction.
 */
export class CandidateExtractorService implements ICandidateExtractor {
  public async extractCandidate(document: ResumeDocument): Promise<Candidate> {
    if (!document.rawText && document.status !== "parsed") {
      throw new ExtractionError(
        `Cannot extract candidate from unparsed document: ${document.fileName}`
      );
    }

    // Candidate profiling and entity recognition will be extended in subsequent phases
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
    const processed = jobDescriptionProcessorService.process(
      jobDescription.rawText
    );

    return {
      ...jobDescription,
      requiredSkills:
        processed.requiredSkills.length > 0
          ? [...processed.requiredSkills]
          : (jobDescription.requiredSkills ?? []),
      preferredSkills:
        processed.preferredSkills.length > 0
          ? [...processed.preferredSkills]
          : (jobDescription.preferredSkills ?? []),
      minExperienceYears:
        processed.experienceRequirement?.minimumYears ??
        jobDescription.minExperienceYears,
    };
  }
}

export const candidateExtractorService = new CandidateExtractorService();
