import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EmptyResultsStateProps {
  filesCount: number;
  hasJobDescription: boolean;
}

export function EmptyResultsState({
  filesCount,
  hasJobDescription,
}: EmptyResultsStateProps) {
  return (
    <Card className="border-slate-800 bg-slate-900/40">
      <CardHeader className="pb-2 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/60 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-blue-500/10 text-indigo-400 shadow-inner">
          <svg
            className="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
            />
          </svg>
        </div>
        <CardTitle className="text-lg font-semibold text-slate-100">
          Candidate Ranking Workspace
        </CardTitle>
        <CardDescription className="mx-auto max-w-lg">
          No candidates evaluated yet. Complete the requisition inputs above and trigger
          the ranking engine to generate real-time match scores.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 pt-2">
        {/* Readiness Checklist */}
        <div className="mx-auto max-w-md space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
            Pipeline Readiness
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-slate-300">
              <span
                className={`h-2 w-2 rounded-full ${
                  hasJobDescription ? "bg-emerald-400" : "bg-slate-600"
                }`}
              />
              Target Job Specification
            </span>
            <Badge
              variant={hasJobDescription ? "success" : "outline"}
              className="text-[10px]"
            >
              {hasJobDescription ? "Configured" : "Missing"}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-slate-300">
              <span
                className={`h-2 w-2 rounded-full ${
                  filesCount > 0 ? "bg-emerald-400" : "bg-slate-600"
                }`}
              />
              Uploaded Resumes
            </span>
            <Badge
              variant={filesCount > 0 ? "success" : "outline"}
              className="text-[10px]"
            >
              {filesCount > 0 ? `${filesCount} ready` : "None uploaded"}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              Ranking Engine Service
            </span>
            <Badge variant="purple" className="text-[10px]">
              Phase 1 Standby
            </Badge>
          </div>
        </div>

        {/* Feature Cards Preview */}
        <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-3">
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-4 text-left">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <svg
                className="h-4 w-4"
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
            </div>
            <h4 className="text-xs font-semibold text-slate-200">Explainable Scoring</h4>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Transparent multi-dimensional scoring incorporating skills match, experience
              relevance, and role alignment.
            </p>
          </div>

          <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-4 text-left">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h4 className="text-xs font-semibold text-slate-200">Semantic Matching</h4>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Beyond simple keyword counting: recognizes transferable skills, equivalent
              technologies, and contextual domain depth.
            </p>
          </div>

          <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-4 text-left">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h4 className="text-xs font-semibold text-slate-200">Skills Gap Insights</h4>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Instantly highlights candidate strengths alongside missing requirements to
              accelerate interview prep.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
