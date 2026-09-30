"use client";

import React, { useRef, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UploadedFileItem } from "@/features/screening/types";
import { formatBytes } from "@/lib/utils";
import { envConfig } from "@/config/env";

interface ResumeUploadZoneProps {
  files: readonly UploadedFileItem[];
  onFilesAdded: (files: FileList | File[]) => void;
  onFileRemoved: (fileId: string) => void;
  onClearFiles: () => void;
  error?: string;
}

export function ResumeUploadZone({
  files,
  onFilesAdded,
  onFileRemoved,
  onClearFiles,
  error,
}: ResumeUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesAdded(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesAdded(e.target.files);
      // Reset input value to allow selecting same file again if removed
      e.target.value = "";
    }
  };

  return (
    <Card className="flex h-full flex-col border-slate-800 bg-slate-900/70">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/20 text-xs font-bold text-indigo-400">
              2
            </span>
            <CardTitle className="text-base font-semibold text-slate-100">
              Candidate Resumes
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={files.length > 0 ? "info" : "outline"}
              className="text-[11px]"
            >
              {files.length} {files.length === 1 ? "document" : "documents"}
            </Badge>
            {files.length > 0 && (
              <button
                type="button"
                onClick={onClearFiles}
                className="cursor-pointer text-[11px] text-slate-400 transition-colors hover:text-rose-400"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
        <CardDescription>
          Upload candidate resumes in PDF, DOCX, or TXT format (max{" "}
          {envConfig.maxUploadSizeBytes / (1024 * 1024)}MB each).
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col space-y-4 pt-0">
        {/* Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
            isDragOver
              ? "scale-[1.01] border-indigo-500 bg-indigo-500/10"
              : "border-slate-700/80 bg-slate-950/40 hover:border-slate-600 hover:bg-slate-950/60"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-400">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.75"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          <p className="text-sm font-medium text-slate-200">
            <span className="text-indigo-400 hover:underline">Click to browse</span> or
            drag & drop resumes here
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Supports batch upload of up to {envConfig.maxResumeFiles} resumes
          </p>
        </div>

        {/* Error message */}
        {error && (
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
        )}

        {/* Uploaded File List */}
        {files.length > 0 && (
          <div className="max-h-[220px] flex-1 space-y-2 overflow-y-auto pr-1">
            <div className="px-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Ready for evaluation ({files.length})
            </div>
            {files.map((item) => (
              <div
                key={item.id}
                className="group flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/80 p-2.5 transition-colors hover:border-slate-700"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-400">
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
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-xs font-medium text-slate-200"
                      title={item.name}
                    >
                      {item.name}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <span>{formatBytes(item.size)}</span>
                      <span>&bull;</span>
                      <span className="uppercase">{item.name.split(".").pop()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="success" className="text-[10px]">
                    Ready
                  </Badge>
                  <button
                    type="button"
                    onClick={() => onFileRemoved(item.id)}
                    className="cursor-pointer rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-rose-400"
                    aria-label={`Remove ${item.name}`}
                  >
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
