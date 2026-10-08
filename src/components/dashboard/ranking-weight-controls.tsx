"use client";

import React, { useState, useMemo } from "react";
import { RankingWeights } from "@/types";
import { DEFAULT_FRONTEND_RANKING_WEIGHTS } from "@/features/screening";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface RankingWeightControlsProps {
  readonly weights: RankingWeights;
  readonly onChange: (dimension: keyof RankingWeights, value: number) => void;
  readonly onReset: () => void;
  readonly onApply: () => void;
  readonly isReRanking?: boolean;
  readonly isEvaluating?: boolean;
  readonly hasCandidates?: boolean;
  readonly error?: string;
  readonly defaultExpanded?: boolean;
  readonly className?: string;
}

interface DimensionConfig {
  readonly key: keyof RankingWeights;
  readonly label: string;
  readonly description: string;
  readonly colorClass: string;
  readonly barClass: string;
}

const DIMENSIONS: readonly DimensionConfig[] = [
  {
    key: "requiredSkillsWeight",
    label: "Required Skills",
    description: "Core mandatory competencies extracted from job description",
    colorClass: "text-emerald-400",
    barClass: "accent-emerald-500",
  },
  {
    key: "semanticSimilarityWeight",
    label: "Semantic Similarity",
    description: "Deep vector relevance between resume profile and job context",
    colorClass: "text-blue-400",
    barClass: "accent-blue-500",
  },
  {
    key: "experienceWeight",
    label: "Experience Duration",
    description: "Verified years of professional tenure vs minimum requirement",
    colorClass: "text-indigo-400",
    barClass: "accent-indigo-500",
  },
  {
    key: "preferredSkillsWeight",
    label: "Preferred Skills",
    description: "Secondary skills, tools, and nice-to-have qualifications",
    colorClass: "text-purple-400",
    barClass: "accent-purple-500",
  },
  {
    key: "educationWeight",
    label: "Education Match",
    description: "Academic degrees, fields of study, and institutional alignment",
    colorClass: "text-amber-400",
    barClass: "accent-amber-500",
  },
];

export function RankingWeightControls({
  weights,
  onChange,
  onReset,
  onApply,
  isReRanking = false,
  isEvaluating = false,
  hasCandidates = false,
  error,
  defaultExpanded = false,
  className = "",
}: RankingWeightControlsProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const totalWeight = useMemo(
    () => Object.values(weights).reduce((sum, v) => sum + v, 0),
    [weights]
  );

  const isDefault = useMemo(() => {
    return (
      weights.requiredSkillsWeight === DEFAULT_FRONTEND_RANKING_WEIGHTS.requiredSkillsWeight &&
      weights.semanticSimilarityWeight === DEFAULT_FRONTEND_RANKING_WEIGHTS.semanticSimilarityWeight &&
      weights.experienceWeight === DEFAULT_FRONTEND_RANKING_WEIGHTS.experienceWeight &&
      weights.preferredSkillsWeight === DEFAULT_FRONTEND_RANKING_WEIGHTS.preferredSkillsWeight &&
      weights.educationWeight === DEFAULT_FRONTEND_RANKING_WEIGHTS.educationWeight
    );
  }, [weights]);

  const isDisabled = isReRanking || isEvaluating;
  const isInvalidTotal = totalWeight <= 0;

  return (
    <Card
      data-testid="ranking-weight-controls"
      className={"border-slate-800 bg-slate-900/60 backdrop-blur-md " + className}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-white tracking-tight">
                  Ranking Priority Weights
                </CardTitle>
                <Badge
                  variant={isInvalidTotal ? "danger" : totalWeight === 100 ? "success" : "warning"}
                  className="font-mono text-[11px]"
                >
                  {"Total: " + totalWeight + "%"}
                </Badge>
                {isDefault ? (
                  <Badge variant="outline" className="text-[10px]">
                    Default
                  </Badge>
                ) : (
                  <Badge variant="purple" className="text-[10px]">
                    Customized
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tune criteria distribution to prioritize skills, semantics, experience, or credentials.
              </p>
            </div>
          </div>

          {/* Quick Collapse / Expand Toggle */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="text-xs text-slate-300 hover:text-white"
              aria-expanded={isExpanded}
            >
              <span>{isExpanded ? "Hide Controls" : "Customize Weights"}</span>
              <svg
                className={"h-3.5 w-3.5 transition-transform duration-200 " + (isExpanded ? "rotate-180" : "")}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Expandable Sliders & Action Controls */}
      {isExpanded && (
        <CardContent className="space-y-4 pt-1 border-t border-slate-800/60">
          {/* Dimension Sliders Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            {DIMENSIONS.map((dim) => {
              const val = weights[dim.key];
              return (
                <div
                  key={dim.key}
                  className="space-y-1.5 rounded-lg border border-slate-800/80 bg-slate-950/40 p-3"
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className={dim.colorClass}>{dim.label}</span>
                    <span className="font-mono text-slate-200 font-bold">{val + "%"}</span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={val}
                    disabled={isDisabled}
                    onChange={(e) => onChange(dim.key, parseFloat(e.target.value) || 0)}
                    aria-label={dim.label}
                    className={"h-1.5 w-full cursor-pointer rounded-lg bg-slate-800 " + dim.barClass + " disabled:cursor-not-allowed disabled:opacity-40"}
                  />

                  <p className="text-[10px] leading-tight text-slate-400 line-clamp-2">
                    {dim.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Scaling notice when total != 100 */}
          {totalWeight > 0 && totalWeight !== 100 && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-950/20 p-2.5 text-[11px] text-blue-300 flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                {"Weights sum to " + totalWeight + "%. The server automatically scales non-zero weights proportionally to 100% during evaluation."}
              </span>
            </div>
          )}

          {/* Validation Error Banner */}
          {(error || isInvalidTotal) && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-2.5 text-xs text-rose-300 flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error || "Total configured weight must be greater than 0%."}</span>
            </div>
          )}

          {/* Bottom Action Buttons */}
          <div className="flex flex-col gap-2.5 pt-2 sm:flex-row sm:items-center sm:justify-between border-t border-slate-800/40">
            <div className="text-[11px] text-slate-400">
              {hasCandidates
                ? "Applying weights will re-rank the current candidate pool immediately."
                : "Weights will be applied automatically when resumes are screened."}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                disabled={isDisabled || isDefault}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Reset to Defaults
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={onApply}
                disabled={isDisabled || isInvalidTotal}
                isLoading={isReRanking}
                className="text-xs font-semibold"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{hasCandidates ? "Apply & Re-rank" : "Apply Weights"}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
