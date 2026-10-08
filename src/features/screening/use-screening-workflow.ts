"use client";

import { useState, useCallback, useMemo } from "react";
import { Candidate, RankingResult } from "@/types";
import {
  UploadedFileItem,
  ScreeningWorkflowState,
  CandidateProcessingResult,
} from "./types";
import {
  validateCandidateFile,
  validateJobDescriptionInput,
} from "./screening-validators";
import { SAMPLE_JOB_PRESETS } from "./sample-jobs";
import {
  submitScreeningResumes,
  rankScreeningCandidates,
} from "./screening-api";

export interface UseScreeningWorkflowOptions {
  readonly screeningApi?: typeof submitScreeningResumes;
  readonly rankApi?: typeof rankScreeningCandidates;
}

export function useScreeningWorkflow(options: UseScreeningWorkflowOptions = {}) {
  const {
    screeningApi = submitScreeningResumes,
    rankApi = rankScreeningCandidates,
  } = options;

  const [jobTitle, setJobTitle] = useState<string>("");
  const [jobDescriptionText, setJobDescriptionText] = useState<string>("");
  const [files, setFiles] = useState<UploadedFileItem[]>([]);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [results, setResults] = useState<RankingResult[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateResults, setCandidateResults] = useState<CandidateProcessingResult[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [jobDescError, setJobDescError] = useState<string | undefined>(undefined);
  const [filesError, setFilesError] = useState<string | undefined>(undefined);
  const [rankingNotice, setRankingNotice] = useState<string | null>(null);

  // File upload handler
  const addFiles = useCallback((incomingFiles: FileList | File[]) => {
    setFilesError(undefined);
    setRankingNotice(null);

    const fileArray = Array.from(incomingFiles);
    const errors: string[] = [];

    setFiles((prev) => {
      const combined = [...prev];

      for (const file of fileArray) {
        const validation = validateCandidateFile(file, combined);
        if (!validation.isValid) {
          errors.push(validation.error ?? `Invalid file: ${file.name}`);
          continue;
        }

        const newItem: UploadedFileItem = {
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          status: "ready",
          uploadedAt: new Date().toISOString(),
        };

        combined.push(newItem);
      }

      if (errors.length > 0) {
        setFilesError(errors.join(" "));
      }

      return combined;
    });
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    setRankingNotice(null);
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setResults([]);
    setCandidates([]);
    setCandidateResults([]);
    setWarnings([]);
    setFilesError(undefined);
    setRankingNotice(null);
  }, []);

  const handleJobDescriptionChange = useCallback((text: string) => {
    setJobDescriptionText(text);
    setRankingNotice(null);
    if (text.trim().length > 0) {
      setJobDescError(undefined);
    }
  }, []);

  const loadSampleJob = useCallback((index: number = 0) => {
    const preset = SAMPLE_JOB_PRESETS[index] ?? SAMPLE_JOB_PRESETS[0];
    setJobTitle(preset.title);
    setJobDescriptionText(preset.text);
    setJobDescError(undefined);
    setRankingNotice(null);
  }, []);

  const resetAll = useCallback(() => {
    setJobTitle("");
    setJobDescriptionText("");
    setFiles([]);
    setResults([]);
    setCandidates([]);
    setCandidateResults([]);
    setWarnings([]);
    setGeneralError(null);
    setJobDescError(undefined);
    setFilesError(undefined);
    setRankingNotice(null);
  }, []);

  const hasValidInputs = useMemo(() => {
    const jobValid = validateJobDescriptionInput(jobDescriptionText).isValid;
    const hasFiles = files.length > 0;
    return jobValid && hasFiles && !isEvaluating;
  }, [jobDescriptionText, files.length, isEvaluating]);

  const triggerRanking = useCallback(async () => {
    if (isEvaluating) {
      return;
    }

    setGeneralError(null);
    setRankingNotice(null);
    setWarnings([]);

    // Validate inputs
    const jobValidation = validateJobDescriptionInput(jobDescriptionText);
    if (!jobValidation.isValid) {
      setJobDescError(jobValidation.error);
      return;
    }

    if (files.length === 0) {
      setFilesError("Please upload at least one candidate resume before screening.");
      return;
    }

    setIsEvaluating(true);

    try {
      // Step 1: Upload and extract structured candidate profiles
      const uploadResponse = await screeningApi(files);

      if (!uploadResponse.ok) {
        setGeneralError(uploadResponse.error);
        return;
      }

      const { data: uploadData } = uploadResponse;
      setCandidates(Array.from(uploadData.candidates));
      setCandidateResults(Array.from(uploadData.candidateResults));
      setWarnings(Array.from(uploadData.warnings));

      if (uploadData.candidates.length === 0) {
        if (uploadData.failedCount > 0) {
          setGeneralError(
            `Failed to extract candidate profiles from all ${uploadData.totalProcessed} uploaded resume(s). See error details below.`
          );
        } else {
          setGeneralError("No candidate profiles could be extracted from uploaded files.");
        }
        return;
      }

      // Step 2: Rank extracted candidates against job requisition via server API
      const rankResponse = await rankApi({
        jobDescription: {
          title: jobTitle,
          rawText: jobDescriptionText,
        },
        candidates: uploadData.candidates,
      });

      if (!rankResponse.ok) {
        setGeneralError(`Extraction succeeded, but ranking failed: ${rankResponse.error}`);
        return;
      }

      const rankedResults = Array.from(rankResponse.data.results);
      setResults(rankedResults);

      if (uploadData.successfulCount > 0 && uploadData.failedCount === 0) {
        setRankingNotice(
          `Successfully evaluated and ranked ${rankedResults.length} candidate(s) against "${jobTitle || "Job Requisition"}".`
        );
      } else if (uploadData.successfulCount > 0 && uploadData.failedCount > 0) {
        setRankingNotice(
          `Ranked ${rankedResults.length} candidate(s). ${uploadData.failedCount} resume(s) had extraction issues (see details below).`
        );
      }
    } catch (err) {
      setGeneralError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during resume screening."
      );
    } finally {
      setIsEvaluating(false);
    }
  }, [isEvaluating, jobDescriptionText, jobTitle, files, screeningApi, rankApi]);

  const state: ScreeningWorkflowState = {
    jobTitle,
    jobDescriptionText,
    files,
    isEvaluating,
    results,
    candidates,
    candidateResults,
    warnings,
    generalError,
    validationErrors: {
      jobDescription: jobDescError,
      files: filesError,
    },
  };

  return {
    state,
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
    rankingNotice,
  };
}
