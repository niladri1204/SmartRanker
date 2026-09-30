import { Candidate, JobDescription, RankingResult } from "@/types";

/**
 * Interface definition for candidate ranking and matching engines.
 */
export interface IMatchingEngine {
  /**
   * Evaluates and ranks a batch of candidates against a job specification.
   * Returns candidates sorted by score descending with rank numbers assigned.
   */
  rankCandidates(job: JobDescription, candidates: Candidate[]): Promise<RankingResult[]>;

  /**
   * Evaluates an individual candidate against a job specification.
   */
  evaluateMatch(job: JobDescription, candidate: Candidate): Promise<RankingResult>;
}
