/**
 * Server-only execution context.
 * Match Gap Analysis and Deterministic Explainability Service.
 * Produces structured requirement gap evaluations, qualitative match-strength classifications,
 * deterministic narrative summaries, and risk/attention indicators without LLMs or external calls.
 */
import {
  AttentionFlag,
  Candidate,
  EducationGap,
  ExperienceEvaluation,
  ExperienceGap,
  JobDescription,
  MatchExplanation,
  MatchGapAnalysis,
  MatchStrength,
  RankingResult,
  SemanticGap,
  SkillGap,
  SkillGapItem,
  SkillGapSummary,
  SkillMatchResult,
} from "@/types";
import { normalizeSkill } from "./skill-taxonomy.service";
import { MatchJobInput } from "./matching.interface";

/**
 * Qualitative match strength classification thresholds.
 * - strong: 80 - 100
 * - good: 60 - 79.9
 * - moderate: 40 - 59.9
 * - weak: 0 - 39.9
 */
export const MATCH_STRENGTH_THRESHOLDS = {
  strong: 80,
  good: 60,
  moderate: 40,
} as const;

/**
 * Derives qualitative match strength label from overall score.
 */
export function deriveMatchStrength(overallScore: number): MatchStrength {
  if (overallScore >= MATCH_STRENGTH_THRESHOLDS.strong) {
    return "strong";
  }
  if (overallScore >= MATCH_STRENGTH_THRESHOLDS.good) {
    return "good";
  }
  if (overallScore >= MATCH_STRENGTH_THRESHOLDS.moderate) {
    return "moderate";
  }
  return "weak";
}

/**
 * Analyzes a specific list of JD skills (required or preferred) against matched skills and alias match records.
 */
export function buildSkillGapItems(
  jobSkills: readonly string[],
  matchedJobSkills: readonly string[],
  skillMatches: readonly SkillMatchResult[]
): SkillGapItem[] {
  const matchedSet = new Set(matchedJobSkills.map((s) => s.trim().toLowerCase()));
  const matchesByJdSkill = new Map<string, SkillMatchResult>();

  for (const m of skillMatches) {
    matchesByJdSkill.set(m.jobSkill.trim().toLowerCase(), m);
  }

  return (jobSkills ?? [])
    .filter((s) => s && s.trim().length > 0)
    .map((jdSkill) => {
      const key = jdSkill.trim().toLowerCase();
      const isMatched = matchedSet.has(key);
      const match = matchesByJdSkill.get(key);

      if (isMatched && match) {
        return {
          jdSkill,
          canonicalId: match.canonicalId,
          canonicalName: match.canonicalName,
          isMatched: true,
          candidateSkill: match.candidateSkill,
          isAliasMatch: match.isAliasMatch,
        };
      }

      const norm = normalizeSkill(jdSkill);
      return {
        jdSkill,
        canonicalId: norm.canonicalId,
        canonicalName: norm.canonicalName,
        isMatched: false,
        isAliasMatch: false,
      };
    });
}

/**
 * Analyzes both required and preferred skills to build a complete SkillGap model.
 */
export function analyzeSkillGaps(
  requiredSkills: readonly string[],
  preferredSkills: readonly string[],
  matchedRequiredSkills: readonly string[],
  matchedPreferredSkills: readonly string[],
  missingRequiredSkills: readonly string[],
  skillMatches: readonly SkillMatchResult[] = []
): SkillGap {
  const required = buildSkillGapItems(requiredSkills, matchedRequiredSkills, skillMatches);
  const preferred = buildSkillGapItems(preferredSkills, matchedPreferredSkills, skillMatches);

  const missingPreferred = (preferredSkills ?? []).filter(
    (p) => !matchedPreferredSkills.map((m) => m.trim().toLowerCase()).includes(p.trim().toLowerCase())
  );

  const requiredCount = required.length;
  const requiredMatchedCount = required.filter((s) => s.isMatched).length;
  const requiredMatchRate =
    requiredCount > 0 ? Math.round((requiredMatchedCount / requiredCount) * 1000) / 1000 : 1;

  const preferredCount = preferred.length;
  const preferredMatchedCount = preferred.filter((s) => s.isMatched).length;
  const preferredMatchRate =
    preferredCount > 0 ? Math.round((preferredMatchedCount / preferredCount) * 1000) / 1000 : 1;

  const summaryText =
    requiredCount > 0 || preferredCount > 0
      ? `Required: ${requiredMatchedCount}/${requiredCount} matched; Preferred: ${preferredMatchedCount}/${preferredCount} matched`
      : "No explicit skills specified in job description.";

  const summary: SkillGapSummary = {
    requiredCount,
    requiredMatchedCount,
    requiredMatchRate,
    preferredCount,
    preferredMatchedCount,
    preferredMatchRate,
    missingRequiredSkills: missingRequiredSkills ?? [],
    missingPreferredSkills: missingPreferred,
    summaryText,
  };

  return {
    required,
    preferred,
    summary,
  };
}

/**
 * Analyzes candidate experience duration against job requirements.
 */
export function analyzeExperienceGap(
  expEval?: ExperienceEvaluation
): ExperienceGap {
  if (!expEval || expEval.status === "unavailable") {
    return {
      requiredYears: expEval?.requiredYears,
      candidateYears: expEval?.candidateYears,
      status: "unavailable",
      explanation:
        expEval?.details ?? "No minimum experience requirement specified in job description.",
    };
  }

  const reqYears = expEval.requiredYears ?? 0;
  const candYears = expEval.candidateYears ?? 0;

  if (expEval.status === "meets") {
    return {
      requiredYears: reqYears,
      candidateYears: candYears,
      status: "meets",
      explanation: `Meets or exceeds minimum requirement of ${reqYears} yr(s) with ${candYears} yr(s).`,
    };
  }

  // Below minimum
  if (candYears > 0) {
    return {
      requiredYears: reqYears,
      candidateYears: candYears,
      status: "partial",
      explanation: `Candidate has ${candYears} yr(s), below the minimum requirement of ${reqYears} yr(s).`,
    };
  }

  return {
    requiredYears: reqYears,
    candidateYears: 0,
    status: "does-not-meet",
    explanation: `Candidate has 0 yr(s), below the minimum requirement of ${reqYears} yr(s).`,
  };
}

/**
 * Analyzes education matching results against job criteria.
 */
export function analyzeEducationGap(
  allEducationRequirements: readonly string[],
  matchedEducationRequirements: readonly string[]
): EducationGap {
  if (!allEducationRequirements || allEducationRequirements.length === 0) {
    return {
      matchedRequirements: [],
      unmatchedRequirements: [],
      status: "unavailable",
      explanation: "No explicit education requirement specified in job description.",
    };
  }

  const matchedSet = new Set(matchedEducationRequirements.map((e) => e.trim().toLowerCase()));
  const unmatched = allEducationRequirements.filter(
    (e) => !matchedSet.has(e.trim().toLowerCase())
  );

  if (unmatched.length === 0) {
    return {
      matchedRequirements: [...matchedEducationRequirements],
      unmatchedRequirements: [],
      status: "meets",
      explanation: `Education requirement matched (${matchedEducationRequirements.join(", ")}).`,
    };
  }

  return {
    matchedRequirements: [...matchedEducationRequirements],
    unmatchedRequirements: unmatched,
    status: matchedEducationRequirements.length > 0 ? "meets" : "unmatched",
    explanation:
      matchedEducationRequirements.length > 0
        ? `Partially matched education requirements (${matchedEducationRequirements.join(", ")}).`
        : `Education requirement not met or unverified (${unmatched.join(", ")}).`,
  };
}

/**
 * Analyzes semantic scoring status and builds explanation text.
 */
export function analyzeSemanticGap(
  result: Pick<RankingResult, "semanticAvailability" | "semanticScore" | "semanticSimilarity" | "semanticEvaluation">
): SemanticGap {
  const status = result.semanticAvailability ?? "unavailable";

  if (status === "available" && typeof result.semanticScore === "number") {
    return {
      status: "available",
      score: result.semanticScore,
      similarity: result.semanticSimilarity,
      explanation: `Semantic similarity is ${result.semanticScore}%.`,
    };
  }

  return {
    status,
    score: undefined,
    similarity: undefined,
    explanation: "Semantic scoring was unavailable; deterministic criteria were used.",
  };
}

/**
 * Determines actionable risk/attention flags from match results.
 */
export function deriveAttentionFlags(
  result: RankingResult,
  skillGap: SkillGap,
  expGap: ExperienceGap,
  eduGap: EducationGap
): AttentionFlag[] {
  const flags: AttentionFlag[] = [];

  // 1. Missing required skills
  if (skillGap.summary.missingRequiredSkills.length > 0) {
    flags.push("missing-required-skills");
  }

  // 2. Experience below required
  if (expGap.status === "partial" || expGap.status === "does-not-meet") {
    flags.push("experience-below-required");
  }

  // 3. Education mismatch
  if (eduGap.status === "unmatched") {
    flags.push("education-mismatch");
  }

  // 4. Semantic score unavailable
  if (result.semanticAvailability !== "available") {
    flags.push("semantic-score-unavailable");
  }

  // 5. Insufficient candidate data
  const cand = result.candidate;
  const noSkills = !cand?.skills || cand.skills.length === 0;
  const noExpWhenRequired =
    expGap.requiredYears !== undefined && expGap.status === "unavailable";
  if (noSkills || noExpWhenRequired) {
    flags.push("insufficient-candidate-data");
  }

  return flags;
}

/**
 * Generates concise, fact-based deterministic explanations.
 */
export function generateMatchExplanation(
  strength: MatchStrength,
  overallScore: number,
  result: RankingResult,
  skillGap: SkillGap,
  expGap: ExperienceGap,
  eduGap: EducationGap,
  semGap: SemanticGap
): MatchExplanation {
  const strongestAreas: string[] = [];
  const areasForImprovement: string[] = [];
  const detailedBulletPoints: string[] = [];

  const bd = result.scoreBreakdown;

  // Identify strongest areas (score >= 80)
  if (bd.requiredSkillScore >= 80 && skillGap.summary.requiredCount > 0) {
    strongestAreas.push(`Required Skills (${Math.round(bd.requiredSkillScore)}%)`);
  }
  if (bd.experienceScore >= 80 && expGap.status === "meets") {
    strongestAreas.push(`Experience (${Math.round(bd.experienceScore)}%)`);
  }
  if (typeof bd.semanticScore === "number" && bd.semanticScore >= 80) {
    strongestAreas.push(`Semantic Relevance (${bd.semanticScore}%)`);
  }
  if (bd.preferredSkillScore >= 80 && skillGap.summary.preferredCount > 0) {
    strongestAreas.push(`Preferred Skills (${Math.round(bd.preferredSkillScore)}%)`);
  }
  if (bd.educationScore >= 80 && eduGap.status === "meets") {
    strongestAreas.push(`Education (${Math.round(bd.educationScore)}%)`);
  }

  // Identify areas for improvement
  if (skillGap.summary.missingRequiredSkills.length > 0) {
    areasForImprovement.push(
      `Missing required skills: ${skillGap.summary.missingRequiredSkills.join(", ")}`
    );
  }
  if (expGap.status === "partial" || expGap.status === "does-not-meet") {
    areasForImprovement.push(
      `Experience below requirement (${expGap.candidateYears ?? 0} yrs vs ${expGap.requiredYears} yrs required)`
    );
  }
  if (eduGap.status === "unmatched") {
    areasForImprovement.push(
      `Education requirement not verified (${eduGap.unmatchedRequirements.join(", ")})`
    );
  }

  // Build bullet points
  if (skillGap.summary.requiredCount > 0) {
    detailedBulletPoints.push(
      `Required skills: ${skillGap.summary.requiredMatchedCount}/${skillGap.summary.requiredCount} matched (${Math.round(bd.requiredSkillScore)}%).`
    );
  }

  // Include alias match notes
  for (const item of skillGap.required) {
    if (item.isMatched && item.isAliasMatch && item.candidateSkill) {
      detailedBulletPoints.push(
        `"${item.candidateSkill}" matched "${item.jdSkill}" via canonical skill "${item.canonicalName}".`
      );
    }
  }

  for (const item of skillGap.preferred) {
    if (item.isMatched && item.isAliasMatch && item.candidateSkill) {
      detailedBulletPoints.push(
        `"${item.candidateSkill}" matched "${item.jdSkill}" via canonical skill "${item.canonicalName}".`
      );
    }
  }

  if (expGap.explanation) {
    detailedBulletPoints.push(expGap.explanation);
  }

  if (eduGap.explanation) {
    detailedBulletPoints.push(eduGap.explanation);
  }

  if (semGap.explanation) {
    detailedBulletPoints.push(semGap.explanation);
  }

  if (result.appliedWeights) {
    const w = result.appliedWeights;
    detailedBulletPoints.push(
      `Applied ranking weights: Skills (${w.requiredSkillsWeight}%), Semantic (${w.semanticSimilarityWeight}%), Experience (${w.experienceWeight}%), Preferred (${w.preferredSkillsWeight}%), Education (${w.educationWeight}%).`
    );
  }

  const strengthTitle = strength.charAt(0).toUpperCase() + strength.slice(1);
  const headline = `${strengthTitle} match (${overallScore}%) against job requirements.`;

  return {
    headline,
    strongestAreas,
    areasForImprovement,
    detailedBulletPoints,
  };
}

/**
 * Service orchestrating match gap analysis and explainability generation.
 */
export class MatchAnalysisService {
  /**
   * Performs comprehensive gap analysis for a ranking result against job criteria.
   */
  public analyze(
    result: RankingResult,
    jobCriteria: {
      requiredSkills?: readonly string[];
      preferredSkills?: readonly string[];
      educationRequirements?: readonly string[];
    }
  ): MatchGapAnalysis {
    const overallScore = result.overallScore ?? result.score;
    const strength = deriveMatchStrength(overallScore);

    const skillGap = analyzeSkillGaps(
      jobCriteria.requiredSkills ?? [],
      jobCriteria.preferredSkills ?? [],
      result.matchedRequiredSkills ?? [],
      result.matchedPreferredSkills ?? [],
      result.missingRequiredSkills ?? [],
      result.skillMatches ?? []
    );

    const experienceGap = analyzeExperienceGap(result.experienceEvaluation);

    const educationGap = analyzeEducationGap(
      jobCriteria.educationRequirements ?? [],
      result.matchedEducationRequirements ?? []
    );

    const semanticGap = analyzeSemanticGap(result);

    const attentionFlags = deriveAttentionFlags(
      result,
      skillGap,
      experienceGap,
      educationGap
    );

    const explanation = generateMatchExplanation(
      strength,
      overallScore,
      result,
      skillGap,
      experienceGap,
      educationGap,
      semanticGap
    );

    return {
      strength,
      overallScore,
      skillGap,
      experienceGap,
      educationGap,
      semanticGap,
      explanation,
      attentionFlags,
      analyzedAt: new Date().toISOString(),
    };
  }
}

export const matchAnalysisService = new MatchAnalysisService();