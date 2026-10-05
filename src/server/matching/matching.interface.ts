import { Candidate, JobDescription, RankingResult } from "@/types";
import { ProcessedJobDescription } from "../intelligence";

/**
 * Supported job input formats for candidate matching.
 */
export type MatchJobInput = JobDescription | ProcessedJobDescription;

/**
 * Interface definition for candidate ranking and matching engines.
 */
export interface IMatchingEngine {
  /**
   * Evaluates and ranks a batch of candidates against a job specification.
   * Returns candidates sorted by score descending with rank numbers assigned.
   */
  rankCandidates(
    job: MatchJobInput,
    candidates: Candidate[]
  ): Promise<RankingResult[]>;

  /**
   * Evaluates an individual candidate against a job specification.
   */
  evaluateMatch(
    job: MatchJobInput,
    candidate: Candidate
  ): Promise<RankingResult>;
}