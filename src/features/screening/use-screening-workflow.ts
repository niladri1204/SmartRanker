"use client";

import { useState, useCallback, useMemo } from "react";
import { Candidate, RankingResult, RankingWeights } from "@/types";
import {
  UploadedFileItem,
  ScreeningWorkflowState,
  CandidateProcessingResult,
  DEFAULT_FRONTEND_RANKING_WEIGHTS,
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
  const [isReRanking, setIsReRanking] = useState<boolean>(false);
  const [results, setResults] = useState<RankingResult[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateResults, setCandidateResults] = useState<CandidateProcessingResult[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [jobDescError, setJobDescError] = useState<string | undefined>(undefined);
  const [filesError, setFilesError] = useState<string | undefined>(undefined);
  const [weightsError, setWeightsError] = useState<string | undefined>(undefined);
  const [rankingNotice, setRankingNotice] = useState<string | null>(null);
  const [rankingWeights, setRankingWeights] = useState<RankingWeights>(DEFAULT_FRONTEND_RANKING_WEIGHTS);

  // Weight modification handlers
  const updateWeight = useCallback((dimension: keyof RankingWeights, value: number) => {
    setRankingWeights((prev) => {
      const sanitized = Math.max(0, isNaN(value) ? 0 : Math.round(value));
      const next = { ...prev, [dimension]: sanitized };
      const total = Object.values(next).reduce((sum, v) => sum + v, 0);
      if (total <= 0) {
        setWeightsError("Total weight must be greater than 0%.");
      } else {
        setWeightsError(undefined);
      }
      return next;
    });
  }, []);

  const resetWeights = useCallback(() => {
    setRankingWeights(DEFAULT_FRONTEND_RANKING_WEIGHTS);
    setWeightsError(undefined);
  }, []);

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
          errors.push(validation.error ?? ("Invalid file: " + file.name));
          continue;
        }

        const newItem: UploadedFileItem = {
          id: "file_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
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
    setWeightsError(undefined);
    setRankingWeights(DEFAULT_FRONTEND_RANKING_WEIGHTS);
    setRankingNotice(null);
  }, []);

  const hasValidInputs = useMemo(() => {
    const jobValid = validateJobDescriptionInput(jobDescriptionText).isValid;
    const hasFiles = files.length > 0;
    return jobValid && hasFiles && !isEvaluating && !isReRanking;
  }, [jobDescriptionText, files.length, isEvaluating, isReRanking]);

  // Initial Screening + Ranking
  const triggerRanking = useCallback(async () => {
    if (isEvaluating || isReRanking) {
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

    const totalWeight = Object.values(rankingWeights).reduce((sum, v) => sum + v, 0);
    if (totalWeight <= 0) {
      setWeightsError("Total weight must be greater than 0%.");
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
            "Failed to extract candidate profiles from all " + uploadData.totalProcessed + " uploaded resume(s). See error details below."
          );
        } else {
          setGeneralError("No candidate profiles could be extracted from uploaded files.");
        }
        return;
      }

      // Step 2: Rank extracted candidates against job requisition with configured weights
      const rankResponse = await rankApi({
        jobDescription: {
          title: jobTitle,
          rawText: jobDescriptionText,
        },
        candidates: uploadData.candidates,
        rankingWeights,
      });

      if (!rankResponse.ok) {
        setGeneralError("Extraction succeeded, but ranking failed: " + rankResponse.error);
        return;
      }

      const rankedResults = Array.from(rankResponse.data.results);
      setResults(rankedResults);

      if (uploadData.successfulCount > 0 && uploadData.failedCount === 0) {
        setRankingNotice(
          "Successfully evaluated and ranked " + rankedResults.length + " candidate(s) against \"" + (jobTitle || "Job Requisition") + "\".",
        );
      } else if (uploadData.successfulCount > 0 && uploadData.failedCount > 0) {
        setRankingNotice(
          "Ranked " + rankedResults.length + " candidate(s). " + uploadData.failedCount + " resume(s) had extraction issues (see details below).",
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
  }, [isEvaluating, isReRanking, jobDescriptionText, jobTitle, files, rankingWeights, screeningApi, rankApi]);

  // Re-Ranking candidates with custom weights (without re-uploading files)
  const applyCustomWeights = useCallback(async () => {
    if (isReRanking || isEvaluating) {
      return;
    }

    const totalWeight = Object.values(rankingWeights).reduce((sum, v) => sum + v, 0);
    if (totalWeight <= 0) {
      setWeightsError("Total weight must be greater than 0%.");
      return;
    }
    setWeightsError(undefined);

    // If no candidates are parsed yet, weights will be applied when screening is executed
    if (candidates.length === 0) {
      return;
    }

    setIsReRanking(true);
    setGeneralError(null);

    try {
      const rankResponse = await rankApi({
        jobDescription: {
          title: jobTitle,
          rawText: jobDescriptionText,
        },
        candidates,
        rankingWeights,
      });

      if (!rankResponse.ok) {
        setGeneralError("Re-ranking failed: " + rankResponse.error);
        return;
      }

      const rankedResults = Array.from(rankResponse.data.results);
      setResults(rankedResults);
      setRankingNotice("Re-ranked " + rankedResults.length + " candidate(s) with updated priority weights.");
    } catch (err) {
      setGeneralError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while re-ranking candidates."
      );
    } finally {
      setIsReRanking(false);
    }
  }, [isReRanking, isEvaluating, rankingWeights, candidates, jobTitle, jobDescriptionText, rankApi]);

  const state: ScreeningWorkflowState = {
    jobTitle,
    jobDescriptionText,
    files,
    isEvaluating,
    isReRanking,
    results,
    candidates,
    candidateResults,
    warnings,
    generalError,
    validationErrors: {
      jobDescription: jobDescError,
      files: filesError,
      weights: weightsError,
    },
    rankingWeights,
    appliedWeights: results.length > 0 ? results[0].appliedWeights : undefined,
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
    rankingWeights,
    updateWeight,
    resetWeights,
    applyCustomWeights,
    isReRanking,
    weightsError,
  };
}
