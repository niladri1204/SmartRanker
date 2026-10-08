"use client";

import React, { useState } from "react";
import { RankingResult, AttentionFlag } from "@/types";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface RankedCandidateCardProps {
  readonly result: RankingResult;
  readonly isExpandedBreakdown?: boolean;
  readonly isExpandedAnalysis?: boolean;
  readonly onToggleBreakdown?: () => void;
  readonly onToggleAnalysis?: () => void;
}

const ATTENTION_FLAG_LABELS: Record<
  AttentionFlag,
  { label: string; icon: string; variant: "warning" | "danger" | "default" }
> = {
  "missing-required-skills": {
    label: "Missing Required Skills",
    icon: "⚠️",
    variant: "warning",
  },
  "experience-below-required": {
    label: "Experience Below Required",
    icon: "⏳",
    variant: "warning",
  },
  "education-mismatch": {
    label: "Education Mismatch",
    icon: "🎓",
    variant: "warning",
  },
  "semantic-score-unavailable": {
    label: "Semantic Scoring Unavailable",
    icon: "ℹ️",
    variant: "default",
  },
  "insufficient-candidate-data": {
    label: "Limited Candidate Data",
    icon: "⚠️",
    variant: "warning",
  },
};

export function RankedCandidateCard({
  result,
  isExpandedBreakdown: controlledBreakdown,
  isExpandedAnalysis: controlledAnalysis,
  onToggleBreakdown,
  onToggleAnalysis,
}: RankedCandidateCardProps) {
  const [internalBreakdownOpen, setInternalBreakdownOpen] = useState(false);
  const [internalAnalysisOpen, setInternalAnalysisOpen] = useState(false);

  const breakdownOpen =
    controlledBreakdown !== undefined ? controlledBreakdown : internalBreakdownOpen;
  const analysisOpen =
    controlledAnalysis !== undefined ? controlledAnalysis : internalAnalysisOpen;

  const toggleBreakdown = () => {
    if (onToggleBreakdown) {
      onToggleBreakdown();
    } else {
      setInternalBreakdownOpen((prev) => !prev);
    }
  };

  const toggleAnalysis = () => {
    if (onToggleAnalysis) {
      onToggleAnalysis();
    } else {
      setInternalAnalysisOpen((prev) => !prev);
    }
  };

  const candidate = result.candidate;
  const matchAnalysis = result.matchAnalysis;
  const strength = matchAnalysis?.strength || "moderate";

  // Score display formatted to 1 decimal place
  const formattedScore = (result.overallScore ?? result.score).toFixed(1);

  // Strength badge variant mapping
  const strengthVariantMap: Record<
    string,
    { variant: "success" | "info" | "warning" | "danger"; label: string; bgClass: string }
  > = {
    strong: {
      variant: "success",
      label: "Strong Match",
      bgClass: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
    },
    good: {
      variant: "info",
      label: "Good Match",
      bgClass: "text-blue-400 border-blue-500/40 bg-blue-500/10",
    },
    moderate: {
      variant: "warning",
      label: "Moderate Match",
      bgClass: "text-amber-400 border-amber-500/40 bg-amber-500/10",
    },
    weak: {
      variant: "danger",
      label: "Weak Match",
      bgClass: "text-rose-400 border-rose-500/40 bg-rose-500/10",
    },
  };

  const strengthMeta = strengthVariantMap[strength] ?? strengthVariantMap.moderate;

  // Breakdown & Weights
  const bd = result.scoreBreakdown;
  const weights = result.appliedWeights ?? {
    requiredSkillsWeight: 40,
    semanticSimilarityWeight: 25,
    experienceWeight: 20,
    preferredSkillsWeight: 10,
    educationWeight: 5,
  };

  // Skill gap items from matchAnalysis
  const skillGap = matchAnalysis?.skillGap;
  const requiredSkillItems = skillGap?.required ?? [];
  const preferredSkillItems = skillGap?.preferred ?? [];

  // Attention flags
  const attentionFlags = matchAnalysis?.attentionFlags ?? [];

  return (
    <Card
      data-testid="ranked-candidate-card"
      data-rank={result.rank}
      className={`border-slate-800 bg-slate-900/70 transition-all duration-200 hover:border-slate-700/80 hover:shadow-2xl hover:shadow-black/40 ${
        result.rank === 1
          ? "border-blue-500/30 bg-gradient-to-b from-slate-900/90 to-blue-950/20"
          : ""
      }`}
    >
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: Rank, Name, Contact */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Rank Badge */}
              <span
                data-testid="rank-badge"
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  result.rank === 1
                    ? "bg-gradient-to-r from-amber-400/20 to-blue-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10"
                    : "bg-slate-800 text-slate-300 border border-slate-700"
                }`}
              >
                {result.rank === 1 ? "★ #1 Top Match" : `#${result.rank}`}
              </span>

              {/* Candidate Full Name */}
              <h4 className="text-base font-bold text-white tracking-tight sm:text-lg">
                {result.candidateName || candidate?.fullName || `Candidate #${result.rank}`}
              </h4>

              {/* Qualitative Strength Badge */}
              <Badge variant={strengthMeta.variant} className="font-semibold text-[11px]">
                {strengthMeta.label}
              </Badge>
            </div>

            {/* Candidate Metadata Row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
              {result.documentId && (
                <span className="text-slate-400 font-mono text-[11px]">
                  📄 {result.documentId}
                </span>
              )}
              {candidate?.email && (
                <span className="flex items-center gap-1 text-slate-300">
                  <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {candidate.email}
                </span>
              )}
              {candidate?.phone && (
                <span className="flex items-center gap-1 text-slate-300">
                  <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {candidate.phone}
                </span>
              )}
              {candidate?.location && (
                <span className="flex items-center gap-1 text-slate-300">
                  <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {candidate.location}
                </span>
              )}
            </div>
          </div>

          {/* Right: Overall Score Display */}
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Match Score
              </span>
              <div
                data-testid="overall-score"
                className="text-2xl font-black tracking-tight text-white sm:text-3xl"
              >
                {`${formattedScore}%`}
              </div>
            </div>
          </div>
        </div>

        {/* Headline Summary */}
        {(matchAnalysis?.explanation.headline || result.summaryNotes) && (
          <p className="mt-2 text-xs leading-relaxed text-slate-300 border-l-2 border-blue-500/40 pl-2.5">
            {matchAnalysis?.explanation.headline || result.summaryNotes}
          </p>
        )}

        {/* Attention / Risk Flags */}
        {attentionFlags.length > 0 && (
          <div data-testid="attention-flags" className="mt-3 flex flex-wrap items-center gap-1.5">
            {attentionFlags.map((flag) => {
              const meta = ATTENTION_FLAG_LABELS[flag] ?? {
                label: flag,
                icon: "⚠️",
                variant: "warning",
              };
              return (
                <Badge
                  key={flag}
                  variant={meta.variant}
                  className="text-[11px] font-medium"
                >
                  <span className="mr-0.5">{meta.icon}</span> {meta.label}
                </Badge>
              );
            })}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {/* Skills Evaluation Section */}
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
            <span className="flex items-center gap-1.5">
              <span>Required Skills</span>
              {skillGap?.summary && (
                <span className="text-slate-400 font-normal">
                  ({skillGap.summary.requiredMatchedCount}/{skillGap.summary.requiredCount} matched)
                </span>
              )}
            </span>
          </div>

          {/* Required Skills Badges */}
          <div className="flex flex-wrap gap-1.5">
            {requiredSkillItems.length > 0 ? (
              requiredSkillItems.map((item, idx) => {
                if (item.isMatched) {
                  return (
                    <Badge
                      key={idx}
                      variant="success"
                      className="text-[11px]"
                      title={
                        item.isAliasMatch && item.candidateSkill
                          ? `${item.candidateSkill} matched ${item.jdSkill} via canonical skill ${item.canonicalName}`
                          : undefined
                      }
                    >
                      <span>✓ {item.canonicalName || item.jdSkill}</span>
                      {item.isAliasMatch && item.candidateSkill && (
                        <span className="text-[10px] text-emerald-300/80 font-mono font-normal">
                          {`(${item.candidateSkill} → ${item.canonicalName})`}
                        </span>
                      )}
                    </Badge>
                  );
                }
                return (
                  <Badge
                    key={idx}
                    variant="danger"
                    className="text-[11px] font-medium"
                  >
                    <span>✕ {item.jdSkill}</span>
                    <span className="text-[10px] opacity-75 font-normal">(Missing)</span>
                  </Badge>
                );
              })
            ) : result.missingRequiredSkills && result.missingRequiredSkills.length > 0 ? (
              result.missingRequiredSkills.map((missing, idx) => (
                <Badge key={idx} variant="danger" className="text-[11px]">
                  ✕ {missing} (Missing)
                </Badge>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">
                No explicit required skills evaluated.
              </span>
            )}
          </div>

          {/* Preferred Skills */}
          {preferredSkillItems.length > 0 && (
            <div className="pt-2 border-t border-slate-800/60">
              <div className="mb-1 text-[11px] font-semibold text-slate-400">
                Preferred Skills ({preferredSkillItems.filter((s) => s.isMatched).length}/
                {preferredSkillItems.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {preferredSkillItems.map((item, idx) => (
                  <Badge
                    key={idx}
                    variant={item.isMatched ? "purple" : "outline"}
                    className="text-[10px]"
                  >
                    {item.isMatched ? `✓ ${item.canonicalName || item.jdSkill}` : item.jdSkill}
                    {item.isAliasMatch && item.candidateSkill && (
                      <span className="text-[9px] opacity-80 font-mono">
                        {`(${item.candidateSkill} → ${item.canonicalName})`}
                      </span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dimension Summary Grid */}
        <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-3">
          {/* Experience */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/30 p-2.5">
            <div className="text-[11px] font-semibold text-slate-400">Experience</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-medium text-slate-200">
                {result.experienceEvaluation?.candidateYears !== undefined
                  ? `${result.experienceEvaluation.candidateYears} yr(s)`
                  : "Not Specified"}
              </span>
              <Badge
                variant={
                  result.matchAnalysis?.experienceGap?.status === "meets" ||
                  result.experienceEvaluation?.status === "meets"
                    ? "success"
                    : result.matchAnalysis?.experienceGap?.status === "partial" ||
                      result.experienceEvaluation?.status === "below"
                    ? "warning"
                    : "outline"
                }
                className="text-[10px]"
              >
                {result.matchAnalysis?.experienceGap?.status === "meets" ||
                result.experienceEvaluation?.status === "meets"
                  ? "Meets"
                  : result.matchAnalysis?.experienceGap?.status === "partial"
                  ? "Partial"
                  : result.matchAnalysis?.experienceGap?.status === "does-not-meet" ||
                    result.experienceEvaluation?.status === "below"
                  ? "Below"
                  : "Unavailable"}
              </Badge>
            </div>
            {result.experienceEvaluation?.requiredYears !== undefined && (
              <div className="mt-0.5 text-[10px] text-slate-400">
                Required: {result.experienceEvaluation.requiredYears} yr(s)
              </div>
            )}
          </div>

          {/* Education */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/30 p-2.5">
            <div className="text-[11px] font-semibold text-slate-400">Education</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-medium text-slate-200 truncate max-w-[120px]">
                {result.matchedEducationRequirements &&
                result.matchedEducationRequirements.length > 0
                  ? result.matchedEducationRequirements[0]
                  : candidate?.education?.[0]?.degree || "Not Verified"}
              </span>
              <Badge
                variant={
                  result.matchedEducationRequirements &&
                  result.matchedEducationRequirements.length > 0
                    ? "success"
                    : "outline"
                }
                className="text-[10px]"
              >
                {result.matchedEducationRequirements &&
                result.matchedEducationRequirements.length > 0
                  ? "Verified"
                  : "Unmatched"}
              </Badge>
            </div>
            <div className="mt-0.5 text-[10px] text-slate-400 truncate">
              {candidate?.education?.[0]?.institution || "No degree verified"}
            </div>
          </div>

          {/* Semantic Relevance */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/30 p-2.5">
            <div className="text-[11px] font-semibold text-slate-400">Semantic Relevance</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-medium text-slate-200">
                {typeof result.semanticScore === "number"
                  ? `${result.semanticScore.toFixed(1)}%`
                  : "N/A"}
              </span>
              <Badge
                variant={result.semanticAvailability === "available" ? "info" : "outline"}
                className="text-[10px]"
              >
                {result.semanticAvailability === "available" ? "Evaluated" : "Unavailable"}
              </Badge>
            </div>
            <div className="mt-0.5 text-[10px] text-slate-400 truncate">
              {result.semanticAvailability === "available"
                ? `Model: ${result.semanticModel || "embeddings"}`
                : "Deterministic fallback"}
            </div>
          </div>
        </div>

        {/* Action Controls for Score Breakdown & Match Analysis */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleBreakdown}
            className="text-xs text-slate-300 hover:text-white"
            aria-expanded={breakdownOpen}
          >
            <span>Score Breakdown</span>
            <svg
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                breakdownOpen ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={toggleAnalysis}
            className="text-xs text-slate-300 hover:text-white"
            aria-expanded={analysisOpen}
          >
            <span>Match Analysis</span>
            <svg
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                analysisOpen ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </Button>
        </div>

        {/* Expandable Section 1: Score Breakdown */}
        {breakdownOpen && (
          <div
            data-testid="score-breakdown-section"
            className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4 transition-all"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
              <span>Dimension Contribution & Weights</span>
              <span className="text-[11px] text-slate-400 font-normal">
                Overall: {formattedScore}%
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {/* Required Skills */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300">
                    {`Required Skills (${weights.requiredSkillsWeight}% weight)`}
                  </span>
                  <span className="font-semibold text-slate-100">
                    {Math.round(bd.requiredSkillScore)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, bd.requiredSkillScore))}%` }}
                  />
                </div>
              </div>

              {/* Semantic Relevance */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300">
                    {`Semantic Similarity (${weights.semanticSimilarityWeight}% weight)`}
                  </span>
                  <span className="font-semibold text-slate-100">
                    {typeof bd.semanticScore === "number" ? `${bd.semanticScore.toFixed(1)}%` : "Unavailable"}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, bd.semanticScore ?? 0))}%` }}
                  />
                </div>
              </div>

              {/* Experience */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300">
                    {`Experience Match (${weights.experienceWeight}% weight)`}
                  </span>
                  <span className="font-semibold text-slate-100">
                    {Math.round(bd.experienceScore)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, bd.experienceScore))}%` }}
                  />
                </div>
              </div>

              {/* Preferred Skills */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300">
                    {`Preferred Skills (${weights.preferredSkillsWeight}% weight)`}
                  </span>
                  <span className="font-semibold text-slate-100">
                    {Math.round(bd.preferredSkillScore)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, bd.preferredSkillScore))}%` }}
                  />
                </div>
              </div>

              {/* Education */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300">
                    {`Education (${weights.educationWeight}% weight)`}
                  </span>
                  <span className="font-semibold text-slate-100">
                    {Math.round(bd.educationScore)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, bd.educationScore))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Expandable Section 2: Match Analysis */}
        {analysisOpen && (
          <div
            data-testid="match-analysis-section"
            className="space-y-3.5 rounded-lg border border-slate-800 bg-slate-950/60 p-4 transition-all"
          >
            <div className="text-xs font-semibold text-slate-200">
              Why this candidate? (Deterministic Match Evaluation)
            </div>

            {/* Strongest Areas & Areas for Improvement */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Strongest Areas */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-emerald-400">
                  Strongest Matching Areas
                </div>
                {matchAnalysis?.explanation.strongestAreas &&
                matchAnalysis.explanation.strongestAreas.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {matchAnalysis.explanation.strongestAreas.map((area, idx) => (
                      <Badge key={idx} variant="success" className="text-[10px]">
                        {area}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 italic">
                    No primary strengths identified above 80%.
                  </div>
                )}
              </div>

              {/* Areas for Improvement */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-amber-400">
                  Areas for Improvement
                </div>
                {matchAnalysis?.explanation.areasForImprovement &&
                matchAnalysis.explanation.areasForImprovement.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {matchAnalysis.explanation.areasForImprovement.map((area, idx) => (
                      <Badge key={idx} variant="warning" className="text-[10px]">
                        {area}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 italic">
                    Candidate satisfies all core requirements.
                  </div>
                )}
              </div>
            </div>

            {/* Detailed Explanation Bullets */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
              <div className="text-[11px] font-semibold text-slate-300">
                Evaluation Evidence:
              </div>
              <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                {(
                  matchAnalysis?.explanation.detailedBulletPoints ||
                  result.explanations ||
                  []
                ).map((bullet, idx) => (
                  <li key={idx} className="leading-relaxed text-slate-300/90 text-[11px]">
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
