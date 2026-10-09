"use client";

import React, { useEffect } from "react";
import { RankingResult, AttentionFlag } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface CandidateComparisonModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly candidates: readonly RankingResult[];
  readonly onRemoveCandidate?: (candidateId: string) => void;
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

const STRENGTH_VARIANTS: Record<
  string,
  { label: string; variant: "success" | "info" | "warning" | "danger" }
> = {
  strong: { label: "STRONG MATCH", variant: "success" },
  good: { label: "GOOD MATCH", variant: "info" },
  moderate: { label: "MODERATE MATCH", variant: "warning" },
  weak: { label: "WEAK MATCH", variant: "danger" },
};

export function CandidateComparisonModal({
  isOpen,
  onClose,
  candidates,
  onRemoveCandidate,
}: CandidateComparisonModalProps) {
  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="comparison-modal-title"
      data-testid="candidate-comparison-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="candidate-comparison-modal"
        className="relative flex flex-col w-full max-w-6xl max-h-[92vh] rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2.5">
              <h3
                id="comparison-modal-title"
                className="text-lg font-bold text-white tracking-tight sm:text-xl"
              >
                Side-by-Side Candidate Comparison
              </h3>
              <Badge variant="info" className="text-xs">
                {candidates.length + " " + (candidates.length === 1 ? "Candidate" : "Candidates")}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Compare candidate competency scores, match strength, skills alignment, and gap analysis in server ranking order.
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close comparison dialog"
            data-testid="close-comparison-modal"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {candidates.length < 2 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm text-slate-400">
                Comparison requires at least 2 candidates. Please select another candidate from the dashboard.
              </p>
              <Button variant="outline" size="sm" onClick={onClose}>
                Back to Dashboard
              </Button>
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 md:grid-cols-${candidates.length} gap-4 overflow-x-auto`}
              data-testid="comparison-grid"
            >
              {candidates.map((result) => {
                const candId = result.candidateId || result.id;
                const cand = result.candidate;
                const formattedScore = (result.overallScore ?? result.score).toFixed(1);
                const strengthKey = (result.matchAnalysis?.strength || "moderate").toLowerCase();
                const strengthMeta = STRENGTH_VARIANTS[strengthKey] ?? STRENGTH_VARIANTS.moderate;
                const weights = result.appliedWeights ?? {
                  requiredSkillsWeight: 40,
                  semanticSimilarityWeight: 25,
                  experienceWeight: 20,
                  preferredSkillsWeight: 10,
                  educationWeight: 5,
                };
                const bd = result.scoreBreakdown;
                const aliasMatches = result.skillMatches?.filter((m) => m.isAliasMatch) ?? [];
                const aliasMap = new Map(aliasMatches.map((m) => [m.jobSkill.toLowerCase(), m]));
                const flags = result.matchAnalysis?.attentionFlags ?? [];
                const strongestAreas = result.matchAnalysis?.explanation.strongestAreas ?? [];
                const areasForImprovement = result.matchAnalysis?.explanation.areasForImprovement ?? [];

                return (
                  <div
                    key={candId}
                    data-testid={`comparison-column-${result.rank}`}
                    className={`flex flex-col space-y-4 rounded-xl border p-4 transition-all ${
                      result.rank === 1
                        ? "border-blue-500/40 bg-slate-900/90 shadow-lg shadow-blue-500/5"
                        : "border-slate-800 bg-slate-900/60"
                    }`}
                  >
                    {/* Header: Rank, Name, Remove */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                              result.rank === 1
                                ? "bg-amber-400/20 text-amber-300 border border-amber-500/30"
                                : "bg-slate-800 text-slate-300 border border-slate-700"
                            }`}
                          >
                            {result.rank === 1 ? "★ #1 Top Match" : `#${result.rank}`}
                          </span>
                          <Badge variant={strengthMeta.variant} className="text-[10px] font-semibold">
                            {strengthMeta.label}
                          </Badge>
                        </div>
                        <h4 className="mt-1.5 text-base font-bold text-white tracking-tight">
                          {result.candidateName || cand?.fullName || `Candidate #${result.rank}`}
                        </h4>
                        {result.documentId && (
                          <div className="text-[11px] font-mono text-slate-400 truncate max-w-[200px]">
                            📄 {result.documentId}
                          </div>
                        )}
                      </div>

                      {onRemoveCandidate && (
                        <button
                          onClick={() => onRemoveCandidate(candId)}
                          data-testid={`remove-candidate-btn-${result.rank}`}
                          aria-label={`Remove ${result.candidateName || "candidate"} from comparison`}
                          className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                          title="Remove from comparison"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Overall Score Banner */}
                    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                      <span className="text-xs font-medium text-slate-400">Overall Match Score</span>
                      <span className="text-2xl font-black tracking-tight text-white">
                        {formattedScore + "%"}
                      </span>
                    </div>

                    {/* Headline Explanation */}
                    {(result.matchAnalysis?.explanation.headline || result.summaryNotes) && (
                      <p className="text-xs leading-relaxed text-slate-300 border-l-2 border-blue-500/40 pl-2">
                        {result.matchAnalysis?.explanation.headline || result.summaryNotes}
                      </p>
                    )}

                    {/* Section 1: Score Breakdown & Applied Weights */}
                    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                        <span>Dimension Scores</span>
                        <span className="text-[10px] text-slate-400 font-normal">Weight</span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        {/* Required Skills */}
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300">Required Skills</span>
                          <span className="font-semibold text-slate-100">
                            {Math.round(bd.requiredSkillScore)}%{" "}
                            <span className="text-slate-500 font-normal">({weights.requiredSkillsWeight}%)</span>
                          </span>
                        </div>

                        {/* Semantic Similarity */}
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300">Semantic Relevance</span>
                          <span className="font-semibold text-slate-100">
                            {typeof bd.semanticScore === "number" ? (
                              <>
                                {bd.semanticScore.toFixed(1) + "%"}{" "}
                                <span className="text-slate-500 font-normal">({weights.semanticSimilarityWeight}%)</span>
                              </>
                            ) : (
                              <span className="text-slate-400 font-normal italic">Unavailable</span>
                            )}
                          </span>
                        </div>

                        {/* Experience */}
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300">Experience</span>
                          <span className="font-semibold text-slate-100">
                            {Math.round(bd.experienceScore)}%{" "}
                            <span className="text-slate-500 font-normal">({weights.experienceWeight}%)</span>
                          </span>
                        </div>

                        {/* Preferred Skills */}
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300">Preferred Skills</span>
                          <span className="font-semibold text-slate-100">
                            {Math.round(bd.preferredSkillScore)}%{" "}
                            <span className="text-slate-500 font-normal">({weights.preferredSkillsWeight}%)</span>
                          </span>
                        </div>

                        {/* Education */}
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300">Education</span>
                          <span className="font-semibold text-slate-100">
                            {Math.round(bd.educationScore)}%{" "}
                            <span className="text-slate-500 font-normal">({weights.educationWeight}%)</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Skills Comparison */}
                    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <div className="text-xs font-semibold text-slate-200">Skills Alignment</div>

                      {/* Matched Required Skills */}
                      <div>
                        <div className="text-[11px] font-medium text-slate-400 mb-1">
                          Matched Required Skills ({result.matchedRequiredSkills?.length ?? 0}):
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {result.matchedRequiredSkills && result.matchedRequiredSkills.length > 0 ? (
                            result.matchedRequiredSkills.map((skill) => {
                              const alias = aliasMap.get(skill.toLowerCase());
                              return (
                                <Badge key={skill} variant="success" className="text-[10px]">
                                  <span>{skill}</span>
                                  {alias && (
                                    <span className="text-[9px] text-emerald-300/80 italic ml-1">
                                      {"(via " + alias.candidateSkill + ")"}
                                    </span>
                                  )}
                                </Badge>
                              );
                            })
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">None matched</span>
                          )}
                        </div>
                      </div>

                      {/* Missing Required Skills */}
                      <div>
                        <div className="text-[11px] font-medium text-slate-400 mb-1">
                          Missing Required Skills ({result.missingRequiredSkills?.length ?? 0}):
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {result.missingRequiredSkills && result.missingRequiredSkills.length > 0 ? (
                            result.missingRequiredSkills.map((skill) => (
                              <Badge key={skill} variant="danger" className="text-[10px]">
                                {skill}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-[11px] text-emerald-400 italic">None (All Matched)</span>
                          )}
                        </div>
                      </div>

                      {/* Matched Preferred Skills */}
                      <div>
                        <div className="text-[11px] font-medium text-slate-400 mb-1">
                          Matched Preferred Skills ({result.matchedPreferredSkills?.length ?? 0}):
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {result.matchedPreferredSkills && result.matchedPreferredSkills.length > 0 ? (
                            result.matchedPreferredSkills.map((skill) => (
                              <Badge key={skill} variant="purple" className="text-[10px]">
                                {skill}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">None matched</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Experience & Education */}
                    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <div className="text-xs font-semibold text-slate-200">Credentials & Background</div>

                      {/* Experience */}
                      <div className="text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Experience</span>
                          <Badge
                            variant={
                              result.experienceEvaluation?.status === "meets"
                                ? "success"
                                : result.experienceEvaluation?.status === "below"
                                ? "warning"
                                : "outline"
                            }
                            className="text-[10px]"
                          >
                            {result.experienceEvaluation?.status === "meets"
                              ? "Meets"
                              : result.experienceEvaluation?.status === "below"
                              ? "Below Required"
                              : "Unavailable"}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-slate-300">
                          {typeof result.experienceEvaluation?.candidateYears === "number"
                            ? `${result.experienceEvaluation.candidateYears} yr(s)`
                            : "Years not specified"}
                          {result.experienceEvaluation?.requiredYears !== undefined && (
                            <span className="text-slate-500"> (Required: {result.experienceEvaluation.requiredYears} yrs)</span>
                          )}
                        </div>
                      </div>

                      {/* Education */}
                      <div className="text-xs space-y-1 border-t border-slate-800/60 pt-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Education</span>
                          <Badge
                            variant={
                              result.matchedEducationRequirements && result.matchedEducationRequirements.length > 0
                                ? "success"
                                : "outline"
                            }
                            className="text-[10px]"
                          >
                            {result.matchedEducationRequirements && result.matchedEducationRequirements.length > 0
                              ? "Verified"
                              : "Unmatched"}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-slate-300 truncate">
                          {result.matchedEducationRequirements && result.matchedEducationRequirements.length > 0
                            ? result.matchedEducationRequirements[0]
                            : cand?.education?.[0]?.degree || "No degree verified"}
                        </div>
                      </div>

                      {/* Semantic Relevance Details */}
                      <div className="text-xs space-y-1 border-t border-slate-800/60 pt-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Semantic Engine</span>
                          <Badge
                            variant={result.semanticAvailability === "available" ? "info" : "outline"}
                            className="text-[10px]"
                          >
                            {result.semanticAvailability === "available" ? "Evaluated" : "Unavailable"}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-slate-300">
                          {result.semanticAvailability === "available" ? (
                            <>
                              Score: {(result.semanticScore?.toFixed(1) ?? "") + "%"}{" "}
                              {result.semanticSimilarity !== undefined && (
                                <span className="text-slate-500 font-mono text-[10px]">
                                  (cos: {result.semanticSimilarity.toFixed(4)})
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-500 italic">Deterministic fallback applied</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Attention Flags */}
                    <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <div className="text-xs font-semibold text-slate-200">Attention & Risk Flags</div>
                      {flags.length > 0 ? (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {flags.map((flag) => {
                            const meta = ATTENTION_FLAG_LABELS[flag] ?? {
                              label: flag,
                              icon: "⚠️",
                              variant: "warning",
                            };
                            return (
                              <Badge key={flag} variant={meta.variant} className="text-[10px]">
                                <span>{meta.icon}</span> {meta.label}
                              </Badge>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                          <span>✓</span> None (No attention flags raised)
                        </div>
                      )}
                    </div>

                    {/* Section 5: Strengths & Improvement Areas */}
                    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs">
                      <div className="font-semibold text-slate-200">Match-Gap Analysis</div>

                      <div>
                        <div className="text-[11px] font-medium text-emerald-400 mb-0.5">Strongest Areas:</div>
                        {strongestAreas.length > 0 ? (
                          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                            {strongestAreas.map((area, idx) => (
                              <li key={idx}>{area}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">Standard alignment</span>
                        )}
                      </div>

                      <div className="pt-1 border-t border-slate-800/60">
                        <div className="text-[11px] font-medium text-amber-400 mb-0.5">Areas for Improvement:</div>
                        {areasForImprovement.length > 0 ? (
                          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                            {areasForImprovement.map((area, idx) => (
                              <li key={idx}>{area}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">No major gaps identified</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-3.5 bg-slate-900/60">
          <div className="text-xs text-slate-400">
            {candidates.length} of 3 maximum candidates selected for comparison.
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
