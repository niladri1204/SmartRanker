/**
 * Server-only execution context
 */
import { Candidate, JobDescription, RankingResult } from "@/types";
import { IMatchingEngine } from "./matching.interface";

/**
 * Ranking Engine Service Stub.
 * Architectural foundation for candidate ranking (Phase 2).
 * Algorithm intentionally deferred as per requirements.
 */
export class RankingEngineService implements IMatchingEngine {
  public async evaluateMatch(
    job: JobDescription,
    candidate: Candidate
  ): Promise<RankingResult> {
    // Phase 2 will implement semantic matching / scoring
    return {
      id: `rank_${candidate.id}_${Date.now()}`,
      candidateId: candidate.id,
      candidateName: candidate.fullName,
      documentId: candidate.documentId,
      score: 0,
      rank: 1,
      matchingSkills: [],
      missingSkills: job.requiredSkills ?? [],
      scoreBreakdown: {
        skillsMatch: 0,
        experienceMatch: 0,
        semanticRelevance: 0,
      },
      summaryNotes: "Evaluation pending Phase 2 algorithm execution.",
      evaluatedAt: new Date().toISOString(),
    };
  }

  public async rankCandidates(
    job: JobDescription,
    candidates: Candidate[]
  ): Promise<RankingResult[]> {
    // Phase 2 will implement batch similarity, vector ranking, or hybrid TF-IDF/semantic scoring
    const results = await Promise.all(
      candidates.map((candidate) => this.evaluateMatch(job, candidate))
    );

    return results
      .sort((a, b) => b.score - a.score)
      .map((res, index) => ({
        ...res,
        rank: index + 1,
      }));
  }
}

export const rankingEngineService = new RankingEngineService();
