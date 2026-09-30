"use client";

import { useState, useCallback, useMemo } from "react";
import { UploadedFileItem, ScreeningWorkflowState } from "./types";
import {
  validateCandidateFile,
  validateJobDescriptionInput,
} from "./screening-validators";
import { SAMPLE_JOB_PRESETS } from "./sample-jobs";

export function useScreeningWorkflow() {
  const [jobTitle, setJobTitle] = useState<string>("");
  const [jobDescriptionText, setJobDescriptionText] = useState<string>("");
  const [files, setFiles] = useState<UploadedFileItem[]>([]);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [jobDescError, setJobDescError] = useState<string | undefined>(undefined);
  const [filesError, setFilesError] = useState<string | undefined>(undefined);
  const [rankingNotice, setRankingNotice] = useState<string | null>(null);

  // File upload handler
  const addFiles = useCallback((incomingFiles: FileList | File[]) => {
    setFilesError(undefined);
    setRankingNotice(null);

    const fileArray = Array.from(incomingFiles);
    const newItems: UploadedFileItem[] = [];
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
        newItems.push(newItem);
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
    setGeneralError(null);
    setJobDescError(undefined);
    setFilesError(undefined);
    setRankingNotice(null);
  }, []);

  const hasValidInputs = useMemo(() => {
    const jobValid = validateJobDescriptionInput(jobDescriptionText).isValid;
    const hasFiles = files.length > 0;
    return jobValid && hasFiles;
  }, [jobDescriptionText, files.length]);

  const triggerRanking = useCallback(async () => {
    setGeneralError(null);
    setRankingNotice(null);

    // Validate inputs
    const jobValidation = validateJobDescriptionInput(jobDescriptionText);
    if (!jobValidation.isValid) {
      setJobDescError(jobValidation.error);
      return;
    }

    if (files.length === 0) {
      setFilesError("Please upload at least one candidate resume before ranking.");
      return;
    }

    setIsEvaluating(true);

    try {
      // Simulate validation / pipeline dispatch to architecture boundary
      await new Promise((resolve) => setTimeout(resolve, 800));
      setRankingNotice(
        `Validated ${files.length} candidate resume(s) against the job specification. Matching and ranking algorithm pipeline is ready for Phase 2 execution.`
      );
    } catch (err) {
      setGeneralError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during evaluation."
      );
    } finally {
      setIsEvaluating(false);
    }
  }, [jobDescriptionText, files.length]);

  const state: ScreeningWorkflowState = {
    jobTitle,
    jobDescriptionText,
    files,
    isEvaluating,
    results: [],
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
