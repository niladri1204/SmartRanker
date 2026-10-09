"use client";

import React, { useState, useMemo, useCallback } from "react";
import { CandidateComparisonModal } from "./candidate-comparison-modal";
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
  readonly onExport?: (format: "csv" | "pdf") => Promise<void> | void;
  readonly isExporting?: boolean;
  readonly exportingFormat?: "csv" | "pdf" | null;
  readonly exportError?: string | null;
  readonly selectedCandidateIds?: readonly string[];
  readonly onToggleSelectCandidate?: (candidateId: string) => void;
  readonly onClearComparisonSelection?: () => void;
  readonly isComparisonOpen?: boolean;
  readonly onOpenComparison?: () => void;
  readonly onCloseComparison?: () => void;
}

export function CandidateResultsList({
  results,
  candidates,
  rankingResults,
  warnings,
  onExport,
  isExporting = false,
  exportingFormat = null,
  exportError,
  selectedCandidateIds: controlledSelectedIds,
  onToggleSelectCandidate,
  onClearComparisonSelection,
  isComparisonOpen: controlledIsComparisonOpen,
  onOpenComparison,
  onCloseComparison,
}: CandidateResultsListProps) {
  const [filterMissingSkillsOnly, setFilterMissingSkillsOnly] = useState(false);
  const [expandAllBreakdowns, setExpandAllBreakdowns] = useState<boolean | undefined>(undefined);
  const [expandAllAnalysis, setExpandAllAnalysis] = useState<boolean | undefined>(undefined);

  // Candidate comparison selection state
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const [internalIsComparisonOpen, setInternalIsComparisonOpen] = useState(false);

  const selectedIds =
    controlledSelectedIds !== undefined ? controlledSelectedIds : internalSelectedIds;
  const isComparisonOpen =
    controlledIsComparisonOpen !== undefined
      ? controlledIsComparisonOpen
      : internalIsComparisonOpen;

  const handleToggleCompare = useCallback(
    (candidateId: string) => {
      if (onToggleSelectCandidate) {
        onToggleSelectCandidate(candidateId);
        return;
      }
      setInternalSelectedIds((prev) => {
        if (prev.includes(candidateId)) {
          return prev.filter((id) => id !== candidateId);
        }
        if (prev.length >= 3) {
          return prev; // Prevent selecting more than 3
        }
        return [...prev, candidateId];
      });
    },
    [onToggleSelectCandidate]
  );

  const handleClearCompare = useCallback(() => {
    if (onClearComparisonSelection) {
      onClearComparisonSelection();
    } else {
      setInternalSelectedIds([]);
    }
  }, [onClearComparisonSelection]);

  const handleRemoveCompareCandidate = useCallback(
    (candidateId: string) => {
      if (onToggleSelectCandidate) {
        onToggleSelectCandidate(candidateId);
      } else {
        setInternalSelectedIds((prev) => prev.filter((id) => id !== candidateId));
      }
    },
    [onToggleSelectCandidate]
  );

  const handleOpenComparison = useCallback(() => {
    if (onOpenComparison) {
      onOpenComparison();
    } else {
      setInternalIsComparisonOpen(true);
    }
  }, [onOpenComparison]);

  const handleCloseComparison = useCallback(() => {
    if (onCloseComparison) {
      onCloseComparison();
    } else {
      setInternalIsComparisonOpen(false);
    }
  }, [onCloseComparison]);

  // Selected candidates for comparison preserving exact server ranking order
  const selectedCandidates = useMemo(() => {
    if (!rankingResults) return [];
    return rankingResults.filter((r) =>
      selectedIds.includes(r.candidateId || r.id)
    );
  }, [rankingResults, selectedIds]);

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

            {/* Export CSV Button */}
            {onExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExport("csv")}
                disabled={isExporting}
                isLoading={isExporting && exportingFormat === "csv"}
                className="text-xs text-slate-300 hover:text-white"
                data-testid="export-csv-button"
              >
                <svg
                  className="h-3.5 w-3.5 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span>Export CSV</span>
              </Button>
            )}

            {/* Export PDF Button */}
            {onExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExport("pdf")}
                disabled={isExporting}
                isLoading={isExporting && exportingFormat === "pdf"}
                className="text-xs text-slate-300 hover:text-white"
                data-testid="export-pdf-button"
              >
                <svg
                  className="h-3.5 w-3.5 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>Export PDF</span>
              </Button>
            )}

            {/* Compare Candidates Action */}
            <Button
              variant={selectedIds.length >= 2 ? "primary" : "outline"}
              size="sm"
              onClick={handleOpenComparison}
              disabled={selectedIds.length < 2}
              className="text-xs"
              data-testid="open-comparison-button"
              title={
                selectedIds.length < 2
                  ? "Select 2 or 3 candidates to compare"
                  : `Compare ${selectedIds.length} selected candidates`
              }
            >
              <svg
                className="h-3.5 w-3.5 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <span>{`Compare (${selectedIds.length}/3)`}</span>
            </Button>

            {selectedIds.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearCompare}
                className="text-xs text-slate-400 hover:text-slate-200"
                data-testid="clear-comparison-selection"
              >
                Clear Selection
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Export Error Banner */}
      {exportError && (
        <div
          data-testid="export-error-banner"
          className="rounded-lg border border-red-500/30 bg-red-950/20 p-3.5 text-xs text-red-300"
        >
          <span className="font-semibold text-red-200">Export Error: </span>
          {exportError}
        </div>
      )}

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
                isSelectedForCompare={selectedIds.includes(result.candidateId || result.id)}
                onToggleCompare={handleToggleCompare}
                isCompareDisabled={selectedIds.length >= 3}
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
      {/* Side-by-Side Candidate Comparison Modal */}
      <CandidateComparisonModal
        isOpen={isComparisonOpen}
        onClose={handleCloseComparison}
        candidates={selectedCandidates}
        onRemoveCandidate={handleRemoveCompareCandidate}
      />
    </div>
  );
}
