import React from "react";
import { Candidate, CandidateSkill, CandidateExperience, CandidateEducation } from "@/types";
import { CandidateProcessingResult } from "@/features/screening";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CandidateResultsListProps {
  readonly results: readonly CandidateProcessingResult[];
  readonly candidates: readonly Candidate[];
  readonly warnings: readonly string[];
}

export function CandidateResultsList({
  results,
  candidates,
  warnings,
}: CandidateResultsListProps) {
  const successCount = results.filter((r) => r.status === "success").length;
  const failureCount = results.filter((r) => r.status === "error").length;

  return (
    <div className="space-y-6">
      {/* Header bar with counts and status badges */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-white">
              Screened Candidate Profiles
            </h2>
            <Badge variant="success" className="text-xs">
              {successCount} Extracted
            </Badge>
            {failureCount > 0 && (
              <Badge variant="warning" className="text-xs">
                {failureCount} Failed
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Profiles extracted from uploaded documents. Ranking and scoring will execute in Phase 2.10.
          </p>
        </div>
      </div>

      {/* Global Warnings Banner */}
      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-300">
          <div className="font-semibold text-amber-200">Extraction Warnings:</div>
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-amber-300/90">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Candidate Cards Grid / List */}
      <div className="space-y-4">
        {results.map((result, index) => {
          if (result.status === "error") {
            return (
              <Card
                key={result.document.id || `failed-${index}`}
                className="border-red-500/30 bg-red-950/10"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-200">
                          {result.document.fileName}
                        </span>
                        <Badge variant="warning">Processing Error</Badge>
                      </div>
                      <CardDescription className="text-xs text-red-400/90">
                        {result.error || "Unable to extract candidate details from this file."}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          }

          const candidate = result.candidate;
          if (!candidate) {
            return null;
          }

          return (
            <Card
              key={candidate.id || `candidate-${index}`}
              className="border-slate-800 bg-slate-900/60 transition-colors hover:border-slate-700"
            >
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-semibold text-slate-100">
                        {candidate.fullName || "Unnamed Candidate"}
                      </CardTitle>
                      <Badge variant="success">Profile Extracted</Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="text-slate-300 font-mono text-[11px]">
                        {result.document.fileName}
                      </span>
                      {candidate.email && (
                        <span className="flex items-center gap-1 text-slate-300">
                          <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {candidate.email}
                        </span>
                      )}
                      {candidate.phone && (
                        <span className="flex items-center gap-1 text-slate-300">
                          <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {candidate.phone}
                        </span>
                      )}
                      {candidate.location && (
                        <span className="flex items-center gap-1 text-slate-300">
                          <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {candidate.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {candidate.summary && (
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">
                    {candidate.summary}
                  </p>
                )}
              </CardHeader>

              <CardContent className="space-y-4 pt-1">
                {/* Skills Section */}
                <div>
                  <div className="mb-1.5 text-xs font-semibold text-slate-300">
                    Skills ({candidate.skills.length})
                  </div>
                  {candidate.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {candidate.skills.map((skill: CandidateSkill, sIdx: number) => (
                        <Badge key={sIdx} variant="default" className="text-[11px]">
                          {skill.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic">
                      No explicit skills detected in resume.
                    </div>
                  )}
                </div>

                {/* Experience & Education 2-column on desktop */}
                <div className="grid grid-cols-1 gap-4 pt-1 md:grid-cols-2">
                  {/* Experience */}
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <div className="mb-2 text-xs font-semibold text-slate-300">
                      Experience ({candidate.experiences.length})
                    </div>
                    {candidate.experiences.length > 0 ? (
                      <div className="space-y-2">
                        {candidate.experiences.slice(0, 3).map((exp: CandidateExperience, eIdx: number) => (
                          <div key={exp.id || eIdx} className="text-xs">
                            <div className="font-medium text-slate-200">{exp.role}</div>
                            <div className="text-[11px] text-slate-400">
                              {exp.company}
                              {exp.startDate ? ` (${exp.startDate} - ${exp.endDate || "Present"})` : ""}
                            </div>
                          </div>
                        ))}
                        {candidate.experiences.length > 3 && (
                          <div className="text-[11px] text-slate-500">
                            +{candidate.experiences.length - 3} more role(s)
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic">
                        No structured work experience parsed.
                      </div>
                    )}
                  </div>

                  {/* Education */}
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <div className="mb-2 text-xs font-semibold text-slate-300">
                      Education ({candidate.education.length})
                    </div>
                    {candidate.education.length > 0 ? (
                      <div className="space-y-2">
                        {candidate.education.map((edu: CandidateEducation, eduIdx: number) => (
                          <div key={edu.id || eduIdx} className="text-xs">
                            <div className="font-medium text-slate-200">
                              {edu.degree}
                              {edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ""}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {edu.institution}
                              {edu.graduationYear ? ` (${edu.graduationYear})` : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic">
                        No education records parsed.
                      </div>
                    )}
                  </div>
                </div>

                {/* Document-level Warnings if any */}
                {result.warnings.length > 0 && (
                  <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2.5 text-[11px] text-slate-400">
                    <span className="font-medium text-slate-300">Note: </span>
                    {result.warnings.join(" ")}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}