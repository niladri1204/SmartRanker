"use client";

import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SAMPLE_JOB_PRESETS } from "@/features/screening/sample-jobs";
import { APP_CONFIG } from "@/config/app";

interface JobDescriptionPanelProps {
  jobTitle: string;
  onJobTitleChange: (title: string) => void;
  jobDescriptionText: string;
  onJobDescriptionChange: (text: string) => void;
  onLoadSample: (index: number) => void;
  error?: string;
}

export function JobDescriptionPanel({
  jobTitle,
  onJobTitleChange,
  jobDescriptionText,
  onJobDescriptionChange,
  onLoadSample,
  error,
}: JobDescriptionPanelProps) {
  const charCount = jobDescriptionText.length;
  const isTooShort =
    charCount > 0 && charCount < APP_CONFIG.limits.minJobDescriptionLength;

  return (
    <Card className="flex h-full flex-col border-slate-800 bg-slate-900/70">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/20 text-xs font-bold text-blue-400">
              1
            </span>
            <CardTitle className="text-base font-semibold text-slate-100">
              Target Job Specification
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-[11px]">
            {charCount.toLocaleString()} /{" "}
            {APP_CONFIG.limits.maxJobDescriptionLength.toLocaleString()} chars
          </Badge>
        </div>
        <CardDescription>
          Paste the job requisition or select a sample benchmark role.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col space-y-4 pt-0">
        {/* Quick Sample Presets */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="font-medium text-slate-300">Quick load:</span>
          {SAMPLE_JOB_PRESETS.map((preset, idx) => (
            <button
              key={preset.title}
              type="button"
              onClick={() => onLoadSample(idx)}
              className="cursor-pointer rounded-md border border-slate-700/60 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            >
              {preset.title.split("(")[0]?.trim()}
            </button>
          ))}
        </div>

        {/* Optional Title */}
        <div>
          <label
            htmlFor="job-title-input"
            className="mb-1 block text-xs font-medium text-slate-300"
          >
            Role Title <span className="text-slate-500">(Optional)</span>
          </label>
          <input
            id="job-title-input"
            type="text"
            placeholder="e.g. Senior Full Stack Engineer"
            value={jobTitle}
            onChange={(e) => onJobTitleChange(e.target.value)}
            className="w-full rounded-lg border border-slate-700/80 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Job Description Textarea */}
        <div className="flex flex-1 flex-col">
          <div className="mb-1 flex items-center justify-between">
            <label
              htmlFor="job-desc-textarea"
              className="block text-xs font-medium text-slate-300"
            >
              Job Description & Qualifications <span className="text-rose-400">*</span>
            </label>
            {jobDescriptionText && (
              <button
                type="button"
                onClick={() => onJobDescriptionChange("")}
                className="cursor-pointer text-[11px] text-slate-400 hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>
          <textarea
            id="job-desc-textarea"
            rows={12}
            placeholder="Paste role requirements, required skills, preferred qualifications, years of experience, and day-to-day responsibilities..."
            value={jobDescriptionText}
            onChange={(e) => onJobDescriptionChange(e.target.value)}
            className={`min-h-[220px] w-full flex-1 rounded-lg border bg-slate-950/70 p-3 font-mono text-sm leading-relaxed text-slate-100 placeholder-slate-500 transition-colors focus:ring-1 focus:outline-none ${
              error
                ? "border-rose-500/80 focus:border-rose-500 focus:ring-rose-500"
                : "border-slate-700/80 focus:border-blue-500 focus:ring-blue-500"
            }`}
          />
        </div>

        {/* Validation or Hint */}
        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-rose-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>{error}</span>
          </div>
        ) : isTooShort ? (
          <p className="text-[11px] text-amber-400/90">
            Job description is brief. Adding specific skills and qualifications will
            produce higher-confidence rankings.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
