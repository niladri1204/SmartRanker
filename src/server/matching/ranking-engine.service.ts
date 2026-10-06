/**
 * Server-only execution context
 * Deterministic Baseline Matching and Hybrid Ranking Engine.
 * Evaluates structured Candidate profiles against Job Description requirements
 * using explainable multi-dimensional weighted scoring, non-overlapping experience
 * calculation, conservative education verification, semantic embedding similarity,
 * and deterministic multi-tier tie-breaking.
 */
import {
  Candidate,
  CandidateEducation,
  CandidateExperience,
  CandidateSkill,
  ExperienceEvaluation,
  JobDescription,
  RankingResult,
  ScoreBreakdown,
  SemanticAvailability,
  SemanticScore,
} from "@/types";
import {
  jobDescriptionProcessorService,
  ProcessedJobDescription,
} from "../intelligence";
import { IMatchingEngine, MatchJobInput } from "./matching.interface";
import {
  EmbeddingVector,
  IEmbeddingProvider,
} from "./semantic.interface";
import { calculateSimilarity } from "./cosine-similarity";
import { semanticTextBuilderService } from "./semantic-text-builder";
import { openAiEmbeddingProvider } from "./openai-embedding.provider";
import { skillTaxonomyService } from "./skill-taxonomy.service";
import { DEFAULT_RANKING_WEIGHTS, RankingWeights, RankingWeightsInput, validateRankingWeights } from "./ranking-weights";

/**
 * Baseline dimension weights.
 * Totaling 100 points across the 5 dimensions:
 * - Required skills: 40%
 * - Semantic similarity: 25%
 * - Experience: 20%
 * - Preferred skills: 10%
 * - Education: 5%
 */
const BASELINE_WEIGHTS = {
  requiredSkills: 40,
  semantic: 25,
  experience: 20,
  preferredSkills: 10,
  education: 5,
} as const;

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

/**
 * Parses a date string into a deterministic { year, month } representation.
 */
export function parseMonthYear(
  rawStr?: string,
  isEndDate: boolean = false,
  isCurrent: boolean = false
): { year: number; month: number } | null {
  if (isEndDate && isCurrent) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  if (!rawStr || typeof rawStr !== "string") {
    return null;
  }

  const str = rawStr.trim();
  if (!str) return null;

  if (isEndDate && /^(present|current|now|ongoing)$/i.test(str)) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  // 1. Month name + 4-digit year: "Jan 2020", "January, 2020", "Mar. 2022"
  const monthNameMatch = str.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?,?\s+(\d{4})\b/i
  );
  if (monthNameMatch) {
    const mKey = monthNameMatch[1].toLowerCase().replace(".", "");
    const month = MONTH_NAMES[mKey] ?? 1;
    const year = parseInt(monthNameMatch[2], 10);
    if (year >= 1950 && year <= 2050) {
      return { year, month };
    }
  }

  // 2. Numerical MM/YYYY or MM-YYYY: "01/2020", "1/2020", "01-2020"
  const mmYyyyMatch = str.match(/\b(0?[1-9]|1[0-2])[\/\-](\d{4})\b/);
  if (mmYyyyMatch) {
    const month = parseInt(mmYyyyMatch[1], 10);
    const year = parseInt(mmYyyyMatch[2], 10);
    if (year >= 1950 && year <= 2050) {
      return { year, month };
    }
  }

  // 3. Numerical YYYY/MM or YYYY-MM: "2020-01", "2020/1"
  const yyyyMmMatch = str.match(/\b(\d{4})[\/\-](0?[1-9]|1[0-2])\b/);
  if (yyyyMmMatch) {
    const year = parseInt(yyyyMmMatch[1], 10);
    const month = parseInt(yyyyMmMatch[2], 10);
    if (year >= 1950 && year <= 2050) {
      return { year, month };
    }
  }

  // 4. Standalone 4-digit year: "2020"
  const yearMatch = str.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    if (year >= 1950 && year <= 2050) {
      return { year, month: isEndDate ? 12 : 1 };
    }
  }

  return null;
}

/**
 * Calculates total experience in years by merging non-overlapping date intervals.
 */
export function deriveExperienceYearsFromIntervals(
  experiences: readonly CandidateExperience[]
): number | undefined {
  if (!experiences || experiences.length === 0) {
    return undefined;
  }

  const intervals: Array<[number, number]> = [];

  for (const exp of experiences) {
    const start = parseMonthYear(exp.startDate, false, false);
    const end = parseMonthYear(
      exp.endDate,
      true,
      Boolean(exp.isCurrent)
    );

    if (start && end) {
      const startIdx = start.year * 12 + start.month;
      const endIdx = end.year * 12 + end.month;
      if (startIdx <= endIdx) {
        intervals.push([startIdx, endIdx]);
      }
    }
  }

  if (intervals.length === 0) {
    return undefined;
  }

  // Sort intervals by start month ascending, then end month ascending
  intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  // Merge overlapping or contiguous intervals
  const merged: Array<[number, number]> = [];
  for (const [startIdx, endIdx] of intervals) {
    if (merged.length === 0) {
      merged.push([startIdx, endIdx]);
    } else {
      const last = merged[merged.length - 1];
      if (startIdx <= last[1] + 1) {
        last[1] = Math.max(last[1], endIdx);
      } else {
        merged.push([startIdx, endIdx]);
      }
    }
  }

  // Calculate total months across merged non-overlapping intervals
  const totalMonths = merged.reduce((sum, [s, e]) => sum + (e - s + 1), 0);
  return Math.round((totalMonths / 12) * 10) / 10;
}

/**
 * Returns a numerical degree level hierarchy (0 to 4).
 */
export function getDegreeLevel(text: string): number {
  const lower = text.toLowerCase();
  if (/\b(ph\.?d|doctorate|doctoral)\b/i.test(lower)) return 4;
  if (/\b(master'?s?|m\.s\b|m\.a\b|m\.tech|mba|post[- ]?graduate)\b/i.test(lower)) return 3;
  if (/\b(bachelor'?s?|b\.s\b|b\.a\b|b\.tech|b\.e\b|undergraduate)\b/i.test(lower)) return 2;
  if (/\b(associate'?s?|a\.s\b|a\.a\b)\b/i.test(lower)) return 1;
  return 0;
}

/**
 * Checks whether candidate education satisfies a specific JD requirement.
 */
export function matchesEducationRequirement(
  req: string,
  candidateEducation: readonly CandidateEducation[]
): boolean {
  if (!candidateEducation || candidateEducation.length === 0) {
    return false;
  }

  const reqLower = req.toLowerCase();
  const reqLevel = getDegreeLevel(reqLower);

  if (reqLevel > 0) {
    for (const edu of candidateEducation) {
      const candidateLevel = getDegreeLevel(edu.degree || "");
      if (candidateLevel >= reqLevel) {
        return true;
      }
    }
  }

  for (const edu of candidateEducation) {
    const degLower = (edu.degree || "").toLowerCase();
    const fieldLower = (edu.fieldOfStudy || "").toLowerCase();
    if (degLower && reqLower.includes(degLower)) {
      return true;
    }
    if (fieldLower && fieldLower.length > 2 && reqLower.includes(fieldLower)) {
      return true;
    }
  }

  return false;
}

interface ParsedJobCriteria {
  readonly requiredSkills: readonly string[];
  readonly preferredSkills: readonly string[];
  readonly minExperienceYears?: number;
  readonly educationRequirements: readonly string[];
  readonly explicitRequirements: readonly string[];
}

export interface RankingEngineOptions {
  readonly embeddingProvider?: IEmbeddingProvider | null;
  readonly rankingWeights?: RankingWeightsInput;
}

export interface EvaluateMatchOptions {
  readonly embeddingProvider?: IEmbeddingProvider | null;
  readonly rankingWeights?: RankingWeightsInput;
  readonly jobEmbedding?: EmbeddingVector;
  readonly candidateEmbedding?: EmbeddingVector;
  readonly semanticError?: string;
  readonly semanticStatus?: SemanticAvailability;
}

export class RankingEngineService implements IMatchingEngine {
  private readonly defaultEmbeddingProvider: IEmbeddingProvider | null;
  private readonly defaultRankingWeights: RankingWeights;

  constructor(options: RankingEngineOptions = {}) {
    this.defaultEmbeddingProvider =
      options.embeddingProvider !== undefined
        ? options.embeddingProvider
        : openAiEmbeddingProvider;

    this.defaultRankingWeights = validateRankingWeights(options.rankingWeights);
  }

  /**
   * Normalizes JobDescription or ProcessedJobDescription into structured criteria.
   */
  private extractJobCriteria(job: MatchJobInput): ParsedJobCriteria {
    // 1. ProcessedJobDescription instance
    if ("normalizedText" in job && Array.isArray(job.educationRequirements)) {
      return {
        requiredSkills: job.requiredSkills ?? [],
        preferredSkills: job.preferredSkills ?? [],
        minExperienceYears: job.experienceRequirement?.minimumYears,
        educationRequirements: job.educationRequirements ?? [],
        explicitRequirements: job.explicitRequirements ?? [],
      };
    }

    // 2. Standard JobDescription
    const jd = job as JobDescription;
    const requiredSkills = jd.requiredSkills ?? [];
    const preferredSkills = jd.preferredSkills ?? [];
    let minExperienceYears = jd.minExperienceYears;
    let educationRequirements: string[] = [];
    if ("educationRequirements" in job && Array.isArray((job as { educationRequirements?: unknown }).educationRequirements)) {
      educationRequirements = Array.from((job as unknown as { educationRequirements: readonly string[] }).educationRequirements);
    }
    let explicitRequirements: string[] = [];

    if (jd.rawText && (requiredSkills.length === 0 || educationRequirements.length === 0)) {
      try {
        const processed = jobDescriptionProcessorService.process(jd.rawText);
        educationRequirements = Array.from(processed.educationRequirements);
        explicitRequirements = Array.from(processed.explicitRequirements);
        if (minExperienceYears === undefined) {
          minExperienceYears = processed.experienceRequirement?.minimumYears;
        }
        if (requiredSkills.length === 0 && processed.requiredSkills.length > 0) {
          return {
            requiredSkills: processed.requiredSkills,
            preferredSkills:
              preferredSkills.length > 0 ? preferredSkills : processed.preferredSkills,
            minExperienceYears,
            educationRequirements,
            explicitRequirements,
          };
        }
      } catch {
        // Fallback gracefully
      }
    }

    return {
      requiredSkills,
      preferredSkills,
      minExperienceYears,
      educationRequirements,
      explicitRequirements,
    };
  }

  /**
   * Evaluates an individual candidate against job criteria.
   */
  public async evaluateMatch(
    job: MatchJobInput,
    candidate: Candidate,
    options?: EvaluateMatchOptions
  ): Promise<RankingResult> {
    const criteria = this.extractJobCriteria(job);
    const warnings: string[] = [];
    const explanations: string[] = [];

    const provider =
      options?.embeddingProvider !== undefined
        ? options.embeddingProvider
        : this.defaultEmbeddingProvider;

    const weights =
      options?.rankingWeights !== undefined
        ? validateRankingWeights(options.rankingWeights)
        : this.defaultRankingWeights;

    // --- 1. Skills Matching (with Canonical Taxonomy) ---
    const requiredComparison = skillTaxonomyService.compareSkills(
      candidate.skills ?? [],
      criteria.requiredSkills
    );

    const preferredComparison = skillTaxonomyService.compareSkills(
      candidate.skills ?? [],
      criteria.preferredSkills
    );

    const matchedRequiredSkills = [...requiredComparison.matchedJobSkills];
    const missingRequiredSkills = [...requiredComparison.missingJobSkills];
    const matchedPreferredSkills = [...preferredComparison.matchedJobSkills];
    const allSkillMatches = [
      ...requiredComparison.matches,
      ...preferredComparison.matches,
    ];

    const hasRequiredSkillsDim = criteria.requiredSkills.length > 0;
    const requiredSkillScore = hasRequiredSkillsDim
      ? requiredComparison.matchScore
      : 100;

    const hasPreferredSkillsDim = criteria.preferredSkills.length > 0;
    const preferredSkillScore = hasPreferredSkillsDim
      ? preferredComparison.matchScore
      : 100;

    if (hasRequiredSkillsDim) {
      explanations.push(
        `Matched ${matchedRequiredSkills.length}/${criteria.requiredSkills.length} required skills (${Math.round(requiredSkillScore)}%).`
      );
      for (const match of requiredComparison.matches) {
        if (match.isAliasMatch) {
          explanations.push(
            `"${match.candidateSkill}" matched "${match.jobSkill}" via canonical skill "${match.canonicalName}".`
          );
        }
      }
      for (const missing of missingRequiredSkills.slice(0, 3)) {
        explanations.push(`Missing required skill: ${missing}`);
      }
      if (missingRequiredSkills.length > 3) {
        explanations.push(`+${missingRequiredSkills.length - 3} more missing required skills.`);
      }
    } else {
      explanations.push("No required skills specified in job description.");
    }

    if (hasPreferredSkillsDim) {
      if (matchedPreferredSkills.length > 0) {
        explanations.push(
          `Matched ${matchedPreferredSkills.length}/${criteria.preferredSkills.length} preferred skills (${matchedPreferredSkills.join(", ")}).`
        );
        for (const match of preferredComparison.matches) {
          if (match.isAliasMatch) {
            explanations.push(
              `"${match.candidateSkill}" matched "${match.jobSkill}" via canonical skill "${match.canonicalName}".`
            );
          }
        }
      } else {
        explanations.push(`Matched 0/${criteria.preferredSkills.length} preferred skills.`);
      }
    }
    // --- 2. Experience Matching ---
    let candidateYears: number | undefined = undefined;
    if (
      typeof candidate.totalExperienceYears === "number" &&
      !isNaN(candidate.totalExperienceYears) &&
      candidate.totalExperienceYears >= 0
    ) {
      candidateYears = candidate.totalExperienceYears;
    } else {
      candidateYears = deriveExperienceYearsFromIntervals(candidate.experiences ?? []);
    }

    const hasExpRequirement =
      criteria.minExperienceYears !== undefined && criteria.minExperienceYears !== null;
    let hasExperienceDim = false;
    let experienceScore = 100;
    let experienceEvaluation: ExperienceEvaluation;

    if (!hasExpRequirement) {
      experienceEvaluation = {
        status: "unavailable",
        details: "No minimum experience requirement specified in job description.",
      };
      explanations.push("No minimum experience requirement specified in job description.");
    } else if (candidateYears === undefined) {
      experienceEvaluation = {
        requiredYears: criteria.minExperienceYears,
        status: "unavailable",
        details:
          "Candidate experience duration could not be deterministically determined from resume dates.",
      };
      warnings.push(
        "Experience dimension excluded from scoring due to unparseable employment dates."
      );
      explanations.push(
        "Experience duration could not be deterministically determined from resume dates."
      );
    } else {
      hasExperienceDim = true;
      const minYears = criteria.minExperienceYears!;
      const meets = minYears === 0 || candidateYears >= minYears;
      experienceScore =
        minYears === 0 || candidateYears >= minYears
          ? 100
          : Math.round((candidateYears / minYears) * 1000) / 10;

      experienceEvaluation = {
        requiredYears: minYears,
        candidateYears,
        meetsRequirement: meets,
        status: meets ? "meets" : "below",
        details: meets
          ? `Candidate meets or exceeds minimum requirement of ${minYears} yr(s) with ${candidateYears} yr(s).`
          : `Candidate has ${candidateYears} yr(s), below the minimum requirement of ${minYears} yr(s).`,
      };

      explanations.push(
        meets
          ? `Meets minimum experience requirement (${candidateYears} yrs vs ${minYears} yrs required).`
          : `Below minimum experience requirement (${candidateYears} yrs vs ${minYears} yrs required).`
      );
    }

    // --- 3. Education Matching ---
    const hasEducationRequirements = criteria.educationRequirements.length > 0;
    let hasEducationDim = false;
    let educationScore = 100;
    const matchedEducationRequirements: string[] = [];

    if (hasEducationRequirements) {
      hasEducationDim = true;
      for (const req of criteria.educationRequirements) {
        if (matchesEducationRequirement(req, candidate.education ?? [])) {
          matchedEducationRequirements.push(req);
        }
      }

      educationScore =
        criteria.educationRequirements.length > 0
          ? Math.round(
              (matchedEducationRequirements.length / criteria.educationRequirements.length) * 1000
            ) / 10
          : 100;

      if (matchedEducationRequirements.length > 0) {
        explanations.push(
          `Education requirement matched (${matchedEducationRequirements.join(", ")}).`
        );
      } else {
        explanations.push("Education requirement not met or unverified.");
      }
    } else {
      explanations.push("No explicit education requirement specified in job description.");
    }

    // --- 4. Semantic Similarity Matching ---
    let semanticEvaluation: SemanticScore;

    if (options?.semanticError || options?.semanticStatus === "failed") {
      semanticEvaluation = {
        status: "failed",
        providerId: provider?.providerId,
        modelName: provider?.modelName,
        reason: options.semanticError ?? "Semantic embedding evaluation failed.",
      };
    } else if (options?.jobEmbedding && options?.candidateEmbedding) {
      const similarity = calculateSimilarity(
        options.jobEmbedding,
        options.candidateEmbedding
      );
      const normalizedScore = Math.round(similarity.normalizedScore * 1000) / 10;
      semanticEvaluation = {
        rawCosineSimilarity: Math.round(similarity.score * 10000) / 10000,
        normalizedScore,
        similarityScore: Math.round(similarity.normalizedScore * 1000) / 1000,
        providerId: provider?.providerId,
        modelName: provider?.modelName,
        status: "available",
      };
    } else if (provider) {
      const jobText = semanticTextBuilderService.buildJobText(job);
      const candidateText = semanticTextBuilderService.buildCandidateText(candidate);

      if (!jobText || jobText.trim().length === 0) {
        semanticEvaluation = {
          status: "unavailable",
          providerId: provider.providerId,
          modelName: provider.modelName,
          reason: "Job description has insufficient text for semantic evaluation.",
        };
      } else if (!candidateText || candidateText.trim().length === 0) {
        semanticEvaluation = {
          status: "unavailable",
          providerId: provider.providerId,
          modelName: provider.modelName,
          reason: "Candidate profile has insufficient text for semantic evaluation.",
        };
      } else {
        try {
          const [jVec, cVec] = await Promise.all([
            provider.embed(jobText),
            provider.embed(candidateText),
          ]);
          const similarity = calculateSimilarity(jVec, cVec);
          const normalizedScore = Math.round(similarity.normalizedScore * 1000) / 10;
          semanticEvaluation = {
            rawCosineSimilarity: Math.round(similarity.score * 10000) / 10000,
            normalizedScore,
            similarityScore: Math.round(similarity.normalizedScore * 1000) / 1000,
            providerId: provider.providerId,
            modelName: provider.modelName,
            status: "available",
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          semanticEvaluation = {
            status: "failed",
            providerId: provider.providerId,
            modelName: provider.modelName,
            reason: msg,
          };
        }
      }
    } else {
      semanticEvaluation = {
        status: "unavailable",
        reason: "No semantic embedding provider is configured.",
      };
    }

    const hasSemanticDim =
      semanticEvaluation.status === "available" &&
      typeof semanticEvaluation.normalizedScore === "number";

    if (hasSemanticDim) {
      explanations.push(`Semantic similarity: ${semanticEvaluation.normalizedScore}%.`);
    } else {
      warnings.push("Semantic scoring unavailable; deterministic criteria used.");
      explanations.push("Semantic scoring unavailable; deterministic criteria used.");
    }

    // --- 5. Explicit Requirements Notice ---
    if (criteria.explicitRequirements.length > 0) {
      warnings.push(
        "Explicit operational requirements present in job description could not be evaluated from resume profile."
      );
    }

    // --- 6. Hybrid Weighted Scoring with Proportional Redistribution ---
    const evaluableDimensions = [
      {
        name: "requiredSkills",
        weight: weights.requiredSkillsWeight,
        score: requiredSkillScore,
        active: hasRequiredSkillsDim,
      },
      {
        name: "semantic",
        weight: weights.semanticSimilarityWeight,
        score: semanticEvaluation.normalizedScore ?? 0,
        active: hasSemanticDim,
      },
      {
        name: "experience",
        weight: weights.experienceWeight,
        score: experienceScore,
        active: hasExperienceDim,
      },
      {
        name: "preferredSkills",
        weight: weights.preferredSkillsWeight,
        score: preferredSkillScore,
        active: hasPreferredSkillsDim,
      },
      {
        name: "education",
        weight: weights.educationWeight,
        score: educationScore,
        active: hasEducationDim,
      },
    ].filter((d) => d.active);

    const totalWeight = evaluableDimensions.reduce((sum, d) => sum + d.weight, 0);

    let rawOverallScore = 0;
    if (totalWeight > 0) {
      rawOverallScore = evaluableDimensions.reduce(
        (sum, d) => sum + d.score * (d.weight / totalWeight),
        0
      );
    }

    const overallScore = Math.min(100, Math.max(0, Math.round(rawOverallScore * 10) / 10));

    const scoreBreakdown: ScoreBreakdown = {
      requiredSkillScore,
      preferredSkillScore,
      experienceScore,
      educationScore,
      semanticScore: hasSemanticDim ? semanticEvaluation.normalizedScore : undefined,
      skillsMatch: requiredSkillScore,
      experienceMatch: experienceScore,
      semanticRelevance: hasSemanticDim ? semanticEvaluation.normalizedScore : undefined,
    };

    const summaryNotes = explanations.slice(0, 2).join(" ");

    return {
      id: `rank_${candidate.id}_${Date.now()}`,
      candidateId: candidate.id,
      candidateName: candidate.fullName,
      documentId: candidate.documentId,
      candidate,
      score: overallScore,
      overallScore,
      rank: 1,
      matchingSkills: [...matchedRequiredSkills, ...matchedPreferredSkills],
      missingSkills: missingRequiredSkills,
      matchedRequiredSkills,
      missingRequiredSkills,
      matchedPreferredSkills,
      matchedEducationRequirements,
      experienceEvaluation,
      skillMatches: allSkillMatches,
      appliedWeights: weights,
      semanticEvaluation,
      semanticScore: hasSemanticDim ? semanticEvaluation.normalizedScore : undefined,
      semanticSimilarity: hasSemanticDim ? semanticEvaluation.rawCosineSimilarity : undefined,
      semanticProvider: semanticEvaluation.providerId,
      semanticModel: semanticEvaluation.modelName,
      semanticAvailability: semanticEvaluation.status,
      scoreBreakdown,
      explanations,
      summaryNotes,
      warnings,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Evaluates and ranks a batch of candidates using batch embedding and deterministic multi-tier tie-breaking.
   */
  public async rankCandidates(
    job: MatchJobInput,
    candidates: Candidate[],
    options?: RankingEngineOptions
  ): Promise<RankingResult[]> {
    if (!candidates || candidates.length === 0) {
      return [];
    }

    const provider =
      options?.embeddingProvider !== undefined
        ? options.embeddingProvider
        : this.defaultEmbeddingProvider;

    const weights =
      options?.rankingWeights !== undefined
        ? validateRankingWeights(options.rankingWeights)
        : this.defaultRankingWeights;

    // Batch embedding preparation
    let jobVector: EmbeddingVector | undefined = undefined;
    const candidateVectors: (EmbeddingVector | undefined)[] = new Array(candidates.length).fill(
      undefined
    );
    let semanticBatchError: string | undefined = undefined;
    let semanticStatus: SemanticAvailability = "available";

    if (!provider) {
      semanticStatus = "unavailable";
      semanticBatchError = "No semantic embedding provider is configured.";
    } else {
      const jobText = semanticTextBuilderService.buildJobText(job);
      if (!jobText || jobText.trim().length === 0) {
        semanticStatus = "unavailable";
        semanticBatchError = "Job description has insufficient text for semantic evaluation.";
      } else {
        const candidateTexts = candidates.map((cand) =>
          semanticTextBuilderService.buildCandidateText(cand)
        );

        // Identify non-empty candidate texts to batch embed
        const nonIndices: number[] = [];
        const nonTexts: string[] = [];
        for (let i = 0; i < candidateTexts.length; i++) {
          if (candidateTexts[i].trim().length > 0) {
            nonIndices.push(i);
            nonTexts.push(candidateTexts[i]);
          }
        }

        try {
          if (nonTexts.length > 0) {
            const [jVec, cVecs] = await Promise.all([
              provider.embed(jobText),
              provider.embedBatch(nonTexts),
            ]);
            jobVector = jVec;
            for (let b = 0; b < cVecs.length; b++) {
              candidateVectors[nonIndices[b]] = cVecs[b];
            }
          } else {
            jobVector = await provider.embed(jobText);
          }
        } catch (err) {
          semanticStatus = "failed";
          semanticBatchError = err instanceof Error ? err.message : String(err);
        }
      }
    }

    const results = await Promise.all(
      candidates.map((candidate, idx) =>
        this.evaluateMatch(job, candidate, {
          embeddingProvider: provider,
          rankingWeights: weights,
          jobEmbedding: jobVector,
          candidateEmbedding: candidateVectors[idx],
          semanticError: semanticBatchError,
          semanticStatus: candidateVectors[idx] ? "available" : semanticStatus,
        })
      )
    );

    // Deterministic Sorting & Tie-Breaking:
    // 1. Higher overall score descending
    // 2. Higher required-skill score descending
    // 3. Higher experience score descending
    // 4. Candidate full name ascending (case-insensitive)
    results.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.scoreBreakdown.requiredSkillScore !== a.scoreBreakdown.requiredSkillScore) {
        return b.scoreBreakdown.requiredSkillScore - a.scoreBreakdown.requiredSkillScore;
      }
      if (b.scoreBreakdown.experienceScore !== a.scoreBreakdown.experienceScore) {
        return b.scoreBreakdown.experienceScore - a.scoreBreakdown.experienceScore;
      }
      return a.candidateName.localeCompare(b.candidateName);
    });

    return results.map((res, index) => ({
      ...res,
      rank: index + 1,
    }));
  }
}

export const rankingEngineService = new RankingEngineService();