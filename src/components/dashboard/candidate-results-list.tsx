"use client";

import React, { useState, useMemo } from "react";
import {
  Candidate,
  CandidateEducation,
  CandidateExperience,
  CandidateSkill,
  RankingResult,
} from "@/types";
import { CandidateProcessingResult } from "@/features/screening";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RankedCandidateCard } from "./ranked-candidate-card";

export interface CandidateResultsListProps {
  readonly results: readonly CandidateProcessingResult[];
  readonly candidates: readonly Candidate[];
  readonly rankingResults?: readonly RankingResult[];
  readonly warnings: readonly string[];
}

export function CandidateResultsList({
  results,
  candidates,
  rankingResults,
  warnings,
}: CandidateResultsListProps) {
  const [filterMissingSkillsOnly, setFilterMissingSkillsOnly] = useState(false);
  const [expandAllBreakdowns, setExpandAllBreakdowns] = useState<boolean | undefined>(undefined);
  const [expandAllAnalysis, setExpandAllAnalysis] = useState<boolean | undefined>(undefined);

  const hasRankedResults = Boolean(rankingResults && rankingResults.length > 0);

  // Failed document extraction items
  const failedResults = useMemo(
    () => results.filter((r) => r.status === "error"),
    [results]
  );

  // Filtered ranked results (maintaining exact server-provided order)
  const displayedRankedResults = useMemo(() => {
    if (!rankingResults) return [];
    if (!filterMissingSkillsOnly) return rankingResults;
    return rankingResults.filter(
      (r) =>
        (r.missingRequiredSkills && r.missingRequiredSkills.length > 0) ||
        (r.matchAnalysis?.skillGap.summary.missingRequiredSkills &&
          r.matchAnalysis.skillGap.summary.missingRequiredSkills.length > 0)
    );
  }, [rankingResults, filterMissingSkillsOnly]);

  const topScore = useMemo(() => {
    if (!rankingResults || rankingResults.length === 0) return null;
    const top = rankingResults[0];
    return (top.overallScore ?? top.score).toFixed(1);
  }, [rankingResults]);

  const toggleAllBreakdowns = () => {
    setExpandAllBreakdowns((prev) => !prev);
  };

  const toggleAllAnalysis = () => {
    setExpandAllAnalysis((prev) => !prev);
  };

  return (
    <div className="space-y-6" data-testid="candidate-results-container">
      {/* Header and Recruiter Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-white">
              {hasRankedResults ? "Ranked Candidate Requisition Matches" : "Extracted Candidate Profiles"}
            </h2>
            <Badge variant="info">
              {hasRankedResults
                ? `${rankingResults!.length} Ranked`
                : `${candidates.length} Extracted`}
            </Badge>
            {topScore && (
              <Badge variant="success" className="font-semibold text-xs">
                {`Top Match: ${topScore}%`}
              </Badge>
            )}
            {failedResults.length > 0 && (
              <Badge variant="warning" className="text-xs">
                {failedResults.length} Ingestion {failedResults.length === 1 ? "Issue" : "Issues"}
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {hasRankedResults
              ? "Candidates ranked deterministically against job competencies, experience, education, and semantic relevance."
              : "Structured candidate profiles extracted from uploaded resume documents."}
          </p>
          {hasRankedResults && rankingResults && rankingResults[0]?.appliedWeights && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">Applied Weights:</span>
              <span className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                {"Skills " + rankingResults[0].appliedWeights.requiredSkillsWeight + "% • Semantic " + rankingResults[0].appliedWeights.semanticSimilarityWeight + "% • Exp " + rankingResults[0].appliedWeights.experienceWeight + "% • Pref " + rankingResults[0].appliedWeights.preferredSkillsWeight + "% • Edu " + rankingResults[0].appliedWeights.educationWeight + "%"}
              </span>
            </div>
          )}
        </div>

        {/* Recruiter Controls Toolbar */}
        {hasRankedResults && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Visual Filter: Show Missing Skills Only */}
            <Button
              variant={filterMissingSkillsOnly ? "primary" : "outline"}
              size="sm"
              onClick={() => setFilterMissingSkillsOnly((prev) => !prev)}
              className="text-xs"
            >
              <span>{filterMissingSkillsOnly ? "✓ Missing Skills Only" : "Filter: Missing Skills"}</span>
            </Button>

            {/* Expand / Collapse All Breakdown */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAllBreakdowns}
              className="text-xs text-slate-300 hover:text-white"
            >
              <span>{expandAllBreakdowns ? "Collapse Breakdown" : "Expand Breakdown"}</span>
            </Button>

            {/* Expand / Collapse All Analysis */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAllAnalysis}
              className="text-xs text-slate-300 hover:text-white"
            >
              <span>{expandAllAnalysis ? "Collapse Analysis" : "Expand Analysis"}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Global Warnings Banner */}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3.5 text-xs text-amber-300">
          <div className="font-semibold text-amber-200">Requisition Notice:</div>
          <ul className="mt-1 list-disc list-inside space-y-0.5 text-amber-300/90">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Primary Ranked Candidate Results List */}
      {hasRankedResults ? (
        <div className="space-y-4" data-testid="ranked-candidate-list">
          {displayedRankedResults.length > 0 ? (
            displayedRankedResults.map((result) => (
              <RankedCandidateCard
                key={result.id || result.candidateId || `rank-${result.rank}`}
                result={result}
                isExpandedBreakdown={expandAllBreakdowns}
                isExpandedAnalysis={expandAllAnalysis}
              />
            ))
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center">
              <p className="text-sm text-slate-400">
                No candidates with missing required skills match the current filter.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilterMissingSkillsOnly(false)}
                className="mt-3 text-xs"
              >
                Clear Filter
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Fallback: Unranked Candidate Profiles */
        <div className="space-y-4">
          {results.map((result, index) => {
            if (result.status === "error") {
              return (
                <Card
                  key={result.document.id || `error-${index}`}
                  className="border-red-900/40 bg-red-950/20 text-red-200"
                >
                  <CardHeader className="p-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="warning">Extraction Failed</Badge>
                      <CardTitle className="text-sm font-medium">
                        {result.document.fileName}
                      </CardTitle>
                    </div>
                    <CardDescription className="text-xs text-red-400 mt-1">
                      {result.error || "Unable to extract candidate details from this file."}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            }

            const candidate = result.candidate;
            if (!candidate) return null;

            return (
              <Card
                key={candidate.id || `candidate-${index}`}
                className="border-slate-800 bg-slate-900/60"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-slate-100">
                      {candidate.fullName}
                    </CardTitle>
                    <Badge variant="success">Profile Extracted</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-slate-300">
                  <div>Skills: {candidate.skills.map((s) => s.name).join(", ")}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Partial Ingestion Failures Section */}
      {hasRankedResults && failedResults.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Resume Extraction Warnings & Ingestion Issues ({failedResults.length})</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            The following files could not be processed into candidate profiles and were excluded from ranking:
          </p>
          <div className="space-y-2">
            {failedResults.map((failed, idx) => (
              <div
                key={failed.document.id || idx}
                className="flex items-start justify-between rounded-lg border border-slate-800 bg-slate-900/80 p-2.5 text-xs"
              >
                <div>
                  <span className="font-mono text-slate-200 text-[11px]">
                    {failed.document.fileName}
                  </span>
                  <p className="text-[11px] text-rose-400 mt-0.5">
                    {failed.error || "File could not be parsed into a structured candidate."}
                  </p>
                </div>
                <Badge variant="warning" className="text-[10px]">
                  Failed
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
