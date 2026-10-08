/**
 * Server-only execution context.
 * Strongly typed ranking weights configuration model, default constants,
 * and robust proportional normalization and validation utilities.
 */
import { RankingWeights, RankingWeightsInput } from "@/types";

export type { RankingWeights, RankingWeightsInput };

/**
 * Default ranking weights adhering to Phase 3 baseline:
 * - Required skills: 40 (40%)
 * - Semantic similarity: 25 (25%)
 * - Experience: 20 (20%)
 * - Preferred skills: 10 (10%)
 * - Education: 5 (5%)
 * Totaling 100%.
 *
 * NOTE: Throughout SmartRanker, RankingWeights and RankingResult.appliedWeights
 * always use percentage numbers summing to 100 (e.g. 50, 20, 15, 10, 5), NOT fractional decimals (0.50, 0.20, etc.).
 */
export const DEFAULT_RANKING_WEIGHTS: RankingWeights = Object.freeze({
  requiredSkillsWeight: 40,
  semanticSimilarityWeight: 25,
  experienceWeight: 20,
  preferredSkillsWeight: 10,
  educationWeight: 5,
});

/**
 * Domain error thrown when a ranking weights configuration violates validation rules.
 */
export class InvalidRankingWeightsError extends Error {
  public readonly code = "INVALID_RANKING_WEIGHTS";

  constructor(message: string) {
    super(message);
    this.name = "InvalidRankingWeightsError";
    Object.setPrototypeOf(this, InvalidRankingWeightsError.prototype);
  }
}

/**
 * Validates ranking weights and proportionally normalizes them so they sum to 100.
 *
 * Validation Rules:
 * - If input is null/undefined, returns DEFAULT_RANKING_WEIGHTS.
 * - Every weight must be a finite number (no NaN, no Infinity).
 * - Every weight must be non-negative (>= 0).
 * - Total configured weight must be strictly greater than zero.
 * - When total != 100, weights are scaled proportionally to sum to 100.
 */
export function validateRankingWeights(
  input?: RankingWeightsInput | null
): RankingWeights {
  if (!input) {
    return DEFAULT_RANKING_WEIGHTS;
  }

  const merged = {
    requiredSkillsWeight:
      input.requiredSkillsWeight !== undefined
        ? input.requiredSkillsWeight
        : DEFAULT_RANKING_WEIGHTS.requiredSkillsWeight,
    semanticSimilarityWeight:
      input.semanticSimilarityWeight !== undefined
        ? input.semanticSimilarityWeight
        : DEFAULT_RANKING_WEIGHTS.semanticSimilarityWeight,
    experienceWeight:
      input.experienceWeight !== undefined
        ? input.experienceWeight
        : DEFAULT_RANKING_WEIGHTS.experienceWeight,
    preferredSkillsWeight:
      input.preferredSkillsWeight !== undefined
        ? input.preferredSkillsWeight
        : DEFAULT_RANKING_WEIGHTS.preferredSkillsWeight,
    educationWeight:
      input.educationWeight !== undefined
        ? input.educationWeight
        : DEFAULT_RANKING_WEIGHTS.educationWeight,
  };

  const entries: Array<[keyof RankingWeights, number]> = [
    ["requiredSkillsWeight", merged.requiredSkillsWeight],
    ["semanticSimilarityWeight", merged.semanticSimilarityWeight],
    ["experienceWeight", merged.experienceWeight],
    ["preferredSkillsWeight", merged.preferredSkillsWeight],
    ["educationWeight", merged.educationWeight],
  ];

  for (const [key, value] of entries) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new InvalidRankingWeightsError(
        `Ranking weight '${key}' must be a finite number. Received: ${value}.`
      );
    }
    if (value < 0) {
      throw new InvalidRankingWeightsError(
        `Ranking weight '${key}' must be non-negative (>= 0). Received: ${value}.`
      );
    }
  }

  const total = entries.reduce((sum, [, val]) => sum + val, 0);
  if (total <= 0) {
    throw new InvalidRankingWeightsError(
      "Total configured ranking weights must be greater than zero."
    );
  }

  // If already exactly 100, return frozen object directly
  if (total === 100) {
    return Object.freeze({
      requiredSkillsWeight: merged.requiredSkillsWeight,
      semanticSimilarityWeight: merged.semanticSimilarityWeight,
      experienceWeight: merged.experienceWeight,
      preferredSkillsWeight: merged.preferredSkillsWeight,
      educationWeight: merged.educationWeight,
    });
  }

  // Scale proportionally to sum to 100
  const factor = 100 / total;
  return Object.freeze({
    requiredSkillsWeight: Math.round(merged.requiredSkillsWeight * factor * 10) / 10,
    semanticSimilarityWeight: Math.round(merged.semanticSimilarityWeight * factor * 10) / 10,
    experienceWeight: Math.round(merged.experienceWeight * factor * 10) / 10,
    preferredSkillsWeight: Math.round(merged.preferredSkillsWeight * factor * 10) / 10,
    educationWeight: Math.round(merged.educationWeight * factor * 10) / 10,
  });
}