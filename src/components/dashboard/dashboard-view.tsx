"use client";

import React from "react";
import { useScreeningWorkflow } from "@/features/screening";
import { JobDescriptionPanel } from "./job-description-panel";
import { ResumeUploadZone } from "./resume-upload-zone";
import { EmptyResultsState } from "./empty-results-state";
import { CandidateResultsList } from "./candidate-results-list";
import { RankingWeightControls } from "./ranking-weight-controls";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_CONFIG } from "@/config/app";

export function DashboardView() {
  const {
    jobTitle,
    setJobTitle,
    jobDescriptionText,
    handleJobDescriptionChange,
    files,
    addFiles,
    removeFile,
    clearFiles,
    loadSampleJob,
    resetAll,
    triggerRanking,
    hasValidInputs,
    state,
    rankingNotice,
    rankingWeights,
    updateWeight,
    resetWeights,
    applyCustomWeights,
    isReRanking,
    weightsError,
  } = useScreeningWorkflow();

  return (
    <div className="space-y-8">
      {/* Hero / Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 via-slate-900/50 to-slate-950/80 p-6 shadow-2xl backdrop-blur-md sm:p-8">
        {/* Glow accent */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative z-10 max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
            <span className="flex h-1.5 w-1.5 rounded-full bg-blue-400" />
            Next-Gen Candidate Intelligence
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl">
            {APP_CONFIG.name}
          </h1>

          <p className="mt-2 text-base font-medium text-indigo-300/90 sm:text-lg">
            {APP_CONFIG.tagline}
          </p>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            {APP_CONFIG.shortDescription} Upload job requisitions and candidate batches to
            evaluate competencies, parse credentials, and surface top talent.
          </p>
        </div>
      </div>

      {/* Main Grid: Inputs (Job Spec + Resume Upload) */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <JobDescriptionPanel
          jobTitle={jobTitle}
          onJobTitleChange={setJobTitle}
          jobDescriptionText={jobDescriptionText}
          onJobDescriptionChange={handleJobDescriptionChange}
          onLoadSample={loadSampleJob}
          error={state.validationErrors.jobDescription}
        />

        <ResumeUploadZone
          files={files}
          onFilesAdded={addFiles}
          onFileRemoved={removeFile}
          onClearFiles={clearFiles}
          error={state.validationErrors.files}
        />
      </div>

      {/* Ranking Weights Customization Panel */}
      <RankingWeightControls
        weights={rankingWeights}
        onChange={updateWeight}
        onReset={resetWeights}
        onApply={applyCustomWeights}
        isReRanking={isReRanking}
        isEvaluating={state.isEvaluating}
        hasCandidates={state.candidates.length > 0}
        error={weightsError}
      />

      {/* Action Bar */}
      <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg backdrop-blur-md sm:flex-row sm:p-5">
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <div className="text-xs text-slate-400">
            Ready to screen:{" "}
            <span className="font-semibold text-slate-200">
              {files.length} {files.length === 1 ? "resume" : "resumes"}
            </span>{" "}
            against{" "}
            <span className="font-semibold text-slate-200">
              {jobTitle || "active job specification"}
            </span>
          </div>
        </div>

        <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
          {(jobDescriptionText || files.length > 0) && (
            <Button
              variant="ghost"
              size="md"
              onClick={resetAll}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Reset All
            </Button>
          )}

          <Button
            variant="primary"
            size="lg"
            disabled={!hasValidInputs || state.isEvaluating}
            isLoading={state.isEvaluating}
            onClick={triggerRanking}
            className="w-full min-w-[200px] sm:w-auto"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span>Screen Resumes</span>
            {files.length > 0 && (
              <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                {files.length}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* General Error Banner */}
      {state.generalError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-300">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-red-200">Screening Notice</div>
            <p className="mt-1 text-xs leading-relaxed text-red-300/90">{state.generalError}</p>
          </div>
        </div>
      )}

      {/* Status Notice banner */}
      {rankingNotice && !state.generalError && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-500/30 bg-blue-950/30 p-4 text-sm text-blue-300">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
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
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-blue-200">Screening Status</div>
            <p className="mt-1 text-xs leading-relaxed text-blue-300/90">
              {rankingNotice}
            </p>
          </div>
        </div>
      )}

      {/* Results Area */}
      <div className="space-y-4">
        {state.candidateResults.length > 0 ? (
          <CandidateResultsList
            results={state.candidateResults}
            candidates={state.candidates}
            rankingResults={state.results}
            warnings={state.warnings}
          />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">
                  Evaluation & Ranking Results
                </h2>
                <Badge variant="outline" className="text-xs">
                  0 Screened
                </Badge>
              </div>
            </div>

            <EmptyResultsState
              filesCount={files.length}
              hasJobDescription={Boolean(jobDescriptionText.trim())}
            />
          </>
        )}
      </div>
    </div>
  );
}