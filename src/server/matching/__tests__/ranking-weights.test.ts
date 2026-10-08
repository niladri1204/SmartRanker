import { describe, it, expect } from "vitest";
import {
  DEFAULT_RANKING_WEIGHTS,
  InvalidRankingWeightsError,
  validateRankingWeights,
} from "../ranking-weights";
import { RankingEngineService } from "../ranking-engine.service";
import { IEmbeddingProvider } from "../semantic.interface";
import { Candidate, JobDescription } from "@/types";

function createCandidate(partial: Partial<Candidate> = {}): Candidate {
  return {
    id: partial.id ?? `cand_${Math.random().toString(36).substring(2, 7)}`,
    documentId: partial.documentId ?? "doc_1",
    fullName: partial.fullName ?? "Jane Doe",
    skills: partial.skills ?? [],
    experiences: partial.experiences ?? [],
    education: partial.education ?? [],
    ...partial,
  };
}

function createJob(partial: Partial<JobDescription> = {}): JobDescription {
  return {
    id: partial.id ?? "job_1",
    title: partial.title ?? "Software Engineer",
    rawText: partial.rawText ?? "",
    createdAt: partial.createdAt ?? new Date().toISOString(),
    ...partial,
  };
}

describe("Phase 3.5: Configurable Ranking Weights", () => {
  it("1. default weights remain 40/25/20/10/5", async () => {
    // Exact baseline values
    expect(DEFAULT_RANKING_WEIGHTS.requiredSkillsWeight).toBe(40);
    expect(DEFAULT_RANKING_WEIGHTS.semanticSimilarityWeight).toBe(25);
    expect(DEFAULT_RANKING_WEIGHTS.experienceWeight).toBe(20);
    expect(DEFAULT_RANKING_WEIGHTS.preferredSkillsWeight).toBe(10);
    expect(DEFAULT_RANKING_WEIGHTS.educationWeight).toBe(5);

    const sum =
      DEFAULT_RANKING_WEIGHTS.requiredSkillsWeight +
      DEFAULT_RANKING_WEIGHTS.semanticSimilarityWeight +
      DEFAULT_RANKING_WEIGHTS.experienceWeight +
      DEFAULT_RANKING_WEIGHTS.preferredSkillsWeight +
      DEFAULT_RANKING_WEIGHTS.educationWeight;
    expect(sum).toBe(100);

    // Default validation returns frozen default weights
    expect(validateRankingWeights()).toEqual(DEFAULT_RANKING_WEIGHTS);
    expect(validateRankingWeights(undefined)).toEqual(DEFAULT_RANKING_WEIGHTS);
    expect(validateRankingWeights(null)).toEqual(DEFAULT_RANKING_WEIGHTS);

    // RankingEngineService default constructor applies default weights
    const defaultEngine = new RankingEngineService();
    const job = createJob({ requiredSkills: ["TypeScript"] });
    const candidate = createCandidate({ skills: [{ name: "TypeScript" }] });

    const result = await defaultEngine.evaluateMatch(job, candidate);
    expect(result.appliedWeights).toEqual(DEFAULT_RANKING_WEIGHTS);
  });

  it("2. valid custom weights are normalized/accepted correctly", async () => {
    // Proportional normalization when sum != 100 (e.g. sum = 50 -> doubles each weight)
    const normalized = validateRankingWeights({
      requiredSkillsWeight: 20,
      semanticSimilarityWeight: 10,
      experienceWeight: 10,
      preferredSkillsWeight: 5,
      educationWeight: 5,
    });

    expect(normalized.requiredSkillsWeight).toBe(40);
    expect(normalized.semanticSimilarityWeight).toBe(20);
    expect(normalized.experienceWeight).toBe(20);
    expect(normalized.preferredSkillsWeight).toBe(10);
    expect(normalized.educationWeight).toBe(10);

    const normSum =
      normalized.requiredSkillsWeight +
      normalized.semanticSimilarityWeight +
      normalized.experienceWeight +
      normalized.preferredSkillsWeight +
      normalized.educationWeight;
    expect(normSum).toBe(100);

    // Fractional inputs (0.50, 0.20, etc.) are safely scaled to percentage representation
    const fromFractional = validateRankingWeights({
      requiredSkillsWeight: 0.50,
      semanticSimilarityWeight: 0.20,
      experienceWeight: 0.15,
      preferredSkillsWeight: 0.10,
      educationWeight: 0.05,
    });
    expect(fromFractional.requiredSkillsWeight).toBe(50);
    expect(fromFractional.semanticSimilarityWeight).toBe(20);
    expect(fromFractional.experienceWeight).toBe(15);
    expect(fromFractional.preferredSkillsWeight).toBe(10);
    expect(fromFractional.educationWeight).toBe(5);

    // Engine configured with custom heavy skills weighting (80% skills, 20% experience)
    const customEngine = new RankingEngineService({
      rankingWeights: {
        requiredSkillsWeight: 80,
        experienceWeight: 20,
        semanticSimilarityWeight: 0,
        preferredSkillsWeight: 0,
        educationWeight: 0,
      },
    });

    const job = createJob({
      requiredSkills: ["TypeScript"],
      minExperienceYears: 4,
    });

    // Candidate matches 100% skills, but only 2/4 yrs experience (50% exp score)
    const candidate = createCandidate({
      skills: [{ name: "TypeScript" }],
      totalExperienceYears: 2,
    });

    const result = await customEngine.evaluateMatch(job, candidate);

    // Expected score: 100 * 0.8 + 50 * 0.2 = 80 + 10 = 90.0
    expect(result.score).toBe(90);
    expect(result.overallScore).toBe(90);
    expect(result.appliedWeights?.requiredSkillsWeight).toBe(80);
    expect(result.appliedWeights?.experienceWeight).toBe(20);
  });

  it("3. invalid weights are rejected safely", () => {
    // Negative weights
    expect(() =>
      validateRankingWeights({ requiredSkillsWeight: -10 })
    ).toThrow(InvalidRankingWeightsError);

    // Non-finite / NaN weights
    expect(() =>
      validateRankingWeights({ semanticSimilarityWeight: NaN })
    ).toThrow(InvalidRankingWeightsError);

    // Infinity weights
    expect(() =>
      validateRankingWeights({ experienceWeight: Infinity })
    ).toThrow(InvalidRankingWeightsError);

    // Total weight of zero
    expect(() =>
      validateRankingWeights({
        requiredSkillsWeight: 0,
        semanticSimilarityWeight: 0,
        experienceWeight: 0,
        preferredSkillsWeight: 0,
        educationWeight: 0,
      })
    ).toThrow(InvalidRankingWeightsError);

    // Rejected on RankingEngineService initialization
    expect(
      () =>
        new RankingEngineService({
          rankingWeights: { requiredSkillsWeight: -5 },
        })
    ).toThrow(InvalidRankingWeightsError);
  });

  it("4. unavailable semantic dimension correctly redistributes custom weights", async () => {
    // Provider simulating network/API failure
    const failingProvider: IEmbeddingProvider = {
      providerId: "failing",
      modelName: "fail-v1",
      embed: async () => {
        throw new Error("API rate limit exceeded");
      },
      embedBatch: async () => {
        throw new Error("API rate limit exceeded");
      },
    };

    // Custom weights: 40% skills, 30% semantic, 15% experience, 10% preferred, 5% education (sum = 100)
    const customEngine = new RankingEngineService({
      embeddingProvider: failingProvider,
      rankingWeights: {
        requiredSkillsWeight: 40,
        semanticSimilarityWeight: 30,
        experienceWeight: 15,
        preferredSkillsWeight: 10,
        educationWeight: 5,
      },
    });

    const job = createJob({
      id: "job_custom_fallback",
      requiredSkills: ["Go"],
      minExperienceYears: 4,
    });

    // Candidate matches 100% required skills, but only 2/4 yrs experience (50% exp score)
    const candidate = createCandidate({
      skills: [{ name: "Go" }],
      totalExperienceYears: 2,
    });

    const result = await customEngine.evaluateMatch(job, candidate);

    // Semantic scoring failed -> 30% weight removed from active total
    // Active weights: Required (40) + Experience (15) = 55
    // Score: (100 * 40 + 50 * 15) / 55 = (4000 + 750) / 55 = 4750 / 55 = 86.363... -> 86.4
    expect(result.semanticAvailability).toBe("failed");
    expect(result.score).toBe(86.4);
    expect(result.overallScore).toBe(86.4);
    expect(result.warnings).toContain(
      "Semantic scoring unavailable; deterministic criteria used."
    );
  });
});