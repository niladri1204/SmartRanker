import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { Candidate, RankingResult } from "@/types";
import { CandidateProcessingResult, rankScreeningCandidates } from "@/features/screening";
import { CandidateResultsList } from "@/components/dashboard/candidate-results-list";
import { RankedCandidateCard } from "@/components/dashboard/ranked-candidate-card";

function createMockCandidate(partial: Partial<Candidate> = {}): Candidate {
  return {
    id: partial.id ?? "cand_1",
    documentId: partial.documentId ?? "doc_1",
    fullName: partial.fullName ?? "Jane Dev",
    email: partial.email ?? "jane@example.com",
    skills: partial.skills ?? [{ name: "TypeScript" }],
    experiences: partial.experiences ?? [],
    education: partial.education ?? [],
    ...partial,
  };
}

function createMockRankingResult(partial: Partial<RankingResult> = {}): RankingResult {
  return {
    id: partial.id ?? "rank_1",
    candidateId: partial.candidateId ?? "cand_1",
    candidateName: partial.candidateName ?? "Jane Dev",
    documentId: partial.documentId ?? "jane_resume.pdf",
    candidate: partial.candidate ?? createMockCandidate(),
    score: partial.score ?? 85.5,
    overallScore: partial.overallScore ?? 85.5,
    rank: partial.rank ?? 1,
    matchingSkills: partial.matchingSkills ?? ["TypeScript"],
    missingSkills: partial.missingSkills ?? [],
    matchedRequiredSkills: partial.matchedRequiredSkills ?? ["TypeScript"],
    missingRequiredSkills: partial.missingRequiredSkills ?? [],
    matchedPreferredSkills: partial.matchedPreferredSkills ?? [],
    matchedEducationRequirements: partial.matchedEducationRequirements ?? ["B.S. CS"],
    experienceEvaluation: partial.experienceEvaluation ?? {
      status: "meets",
      requiredYears: 3,
      candidateYears: 5,
      details: "Candidate meets or exceeds requirement.",
    },
    skillMatches: partial.skillMatches ?? [],
    appliedWeights: partial.appliedWeights ?? {
      requiredSkillsWeight: 40,
      semanticSimilarityWeight: 25,
      experienceWeight: 20,
      preferredSkillsWeight: 10,
      educationWeight: 5,
    },
    semanticEvaluation: partial.semanticEvaluation ?? {
      status: "available",
      normalizedScore: 88.0,
      similarityScore: 0.88,
    },
    semanticScore: partial.semanticScore ?? 88.0,
    semanticAvailability: partial.semanticAvailability ?? "available",
    scoreBreakdown: partial.scoreBreakdown ?? {
      requiredSkillScore: 100,
      preferredSkillScore: 80,
      experienceScore: 100,
      educationScore: 100,
      semanticScore: 88.0,
    },
    explanations: partial.explanations ?? [
      "Matched 1/1 required skills (100%).",
      "Meets minimum experience requirement (5 yrs vs 3 yrs required).",
    ],
    summaryNotes: partial.summaryNotes ?? "Strong overall candidate.",
    warnings: partial.warnings ?? [],
    evaluatedAt: partial.evaluatedAt ?? new Date().toISOString(),
    matchAnalysis: partial.matchAnalysis ?? {
      strength: "strong",
      overallScore: 85.5,
      skillGap: {
        required: [
          {
            jdSkill: "TypeScript",
            canonicalId: "typescript",
            canonicalName: "TypeScript",
            isMatched: true,
            isAliasMatch: false,
          },
        ],
        preferred: [],
        summary: {
          requiredCount: 1,
          requiredMatchedCount: 1,
          requiredMatchRate: 1,
          preferredCount: 0,
          preferredMatchedCount: 0,
          preferredMatchRate: 1,
          missingRequiredSkills: [],
          missingPreferredSkills: [],
          summaryText: "Required: 1/1 matched",
        },
      },
      experienceGap: {
        requiredYears: 3,
        candidateYears: 5,
        status: "meets",
        explanation: "Meets or exceeds minimum requirement.",
      },
      educationGap: {
        matchedRequirements: ["B.S. CS"],
        unmatchedRequirements: [],
        status: "meets",
        explanation: "Education requirement matched.",
      },
      semanticGap: {
        status: "available",
        score: 88.0,
        explanation: "Semantic similarity is 88.0%.",
      },
      explanation: {
        headline: "Strong match (85.5%) against job requirements.",
        strongestAreas: ["Required Skills (100%)", "Experience (100%)"],
        areasForImprovement: [],
        detailedBulletPoints: [
          "Required skills: 1/1 matched (100%).",
          "Meets minimum experience requirement.",
          "Semantic similarity is 88.0%.",
        ],
      },
      attentionFlags: [],
      analyzedAt: new Date().toISOString(),
    },
    ...partial,
  };
}

describe("Phase 3.7: Recruiter Ranking UI", () => {
  it("1. ranked candidate data renders in correct server-provided order", () => {
    const candidate1 = createMockRankingResult({
      rank: 1,
      candidateName: "Alice Lead",
      score: 94.2,
      overallScore: 94.2,
    });

    const candidate2 = createMockRankingResult({
      rank: 2,
      candidateName: "Bob Intermediate",
      score: 72.8,
      overallScore: 72.8,
      matchAnalysis: {
        ...candidate1.matchAnalysis!,
        strength: "good",
        overallScore: 72.8,
      },
    });

    const candidate3 = createMockRankingResult({
      rank: 3,
      candidateName: "Charlie Junior",
      score: 51.0,
      overallScore: 51.0,
      matchAnalysis: {
        ...candidate1.matchAnalysis!,
        strength: "moderate",
        overallScore: 51.0,
      },
    });

    // Provide candidates in server-sorted order
    const html = renderToString(
      React.createElement(CandidateResultsList, {
        results: [],
        candidates: [],
        rankingResults: [candidate1, candidate2, candidate3],
        warnings: [],
      })
    );

    // Verify all candidate names and scores appear
    expect(html).toContain("Alice Lead");
    expect(html).toContain("94.2%");
    expect(html).toContain("Bob Intermediate");
    expect(html).toContain("72.8%");
    expect(html).toContain("Charlie Junior");
    expect(html).toContain("51.0%");

    // Verify ordering in output: Alice Lead (#1) -> Bob Intermediate (#2) -> Charlie Junior (#3)
    const pos1 = html.indexOf("Alice Lead");
    const pos2 = html.indexOf("Bob Intermediate");
    const pos3 = html.indexOf("Charlie Junior");

    expect(pos1).toBeGreaterThan(-1);
    expect(pos2).toBeGreaterThan(pos1);
    expect(pos3).toBeGreaterThan(pos2);

    // Verify #1 top match badge
    expect(html).toContain("#1 Top Match");
  });

  it("2. score breakdown and match analysis render correctly", () => {
    const candidate = createMockRankingResult({
      rank: 1,
      candidateName: "Sarah Tech",
      score: 87.4,
      overallScore: 87.4,
    });

    // Render with breakdown and analysis expanded
    const html = renderToString(
      React.createElement(RankedCandidateCard, {
        result: candidate,
        isExpandedBreakdown: true,
        isExpandedAnalysis: true,
      })
    );

    // Score Breakdown checks
    expect(html).toContain("Dimension Contribution &amp; Weights");
    expect(html).toContain("Required Skills (40% weight)");
    expect(html).toContain("Semantic Similarity (25% weight)");
    expect(html).toContain("Experience Match (20% weight)");
    expect(html).toContain("Preferred Skills (10% weight)");
    expect(html).toContain("Education (5% weight)");

    // Match Analysis checks
    expect(html).toContain("Why this candidate?");
    expect(html).toContain("Strongest Matching Areas");
    expect(html).toContain("Required Skills (100%)");
    expect(html).toContain("Experience (100%)");
    expect(html).toContain("Evaluation Evidence:");
    expect(html).toContain("Semantic similarity is 88.0%.");
  });

  it("3. attention flags and missing skills render safely", () => {
    const candidateWithGaps = createMockRankingResult({
      rank: 2,
      candidateName: "David Deficit",
      score: 55.0,
      overallScore: 55.0,
      missingRequiredSkills: ["Kubernetes", "Redis"],
      matchAnalysis: {
        strength: "moderate",
        overallScore: 55.0,
        skillGap: {
          required: [
            {
              jdSkill: "React",
              canonicalId: "react",
              canonicalName: "React",
              isMatched: true,
              candidateSkill: "React.js",
              isAliasMatch: true,
            },
            {
              jdSkill: "Kubernetes",
              canonicalId: "kubernetes",
              canonicalName: "Kubernetes",
              isMatched: false,
              isAliasMatch: false,
            },
            {
              jdSkill: "Redis",
              canonicalId: "redis",
              canonicalName: "Redis",
              isMatched: false,
              isAliasMatch: false,
            },
          ],
          preferred: [],
          summary: {
            requiredCount: 3,
            requiredMatchedCount: 1,
            requiredMatchRate: 0.33,
            preferredCount: 0,
            preferredMatchedCount: 0,
            preferredMatchRate: 1,
            missingRequiredSkills: ["Kubernetes", "Redis"],
            missingPreferredSkills: [],
            summaryText: "Required: 1/3 matched",
          },
        },
        experienceGap: {
          requiredYears: 5,
          candidateYears: 2,
          status: "partial",
          explanation: "Candidate has 2 yr(s), below requirement of 5 yr(s).",
        },
        educationGap: {
          matchedRequirements: [],
          unmatchedRequirements: ["B.S. CS"],
          status: "unmatched",
          explanation: "Education requirement not verified.",
        },
        semanticGap: {
          status: "unavailable",
          explanation: "Semantic scoring was unavailable; deterministic criteria were used.",
        },
        explanation: {
          headline: "Moderate match (55.0%) with notable requirement gaps.",
          strongestAreas: [],
          areasForImprovement: ["Missing required skills: Kubernetes, Redis"],
          detailedBulletPoints: [
            '"React.js" matched "React" via canonical skill "React".',
            "Missing required skills: Kubernetes, Redis",
          ],
        },
        attentionFlags: [
          "missing-required-skills",
          "experience-below-required",
          "semantic-score-unavailable",
        ],
        analyzedAt: new Date().toISOString(),
      },
    });

    const html = renderToString(
      React.createElement(RankedCandidateCard, {
        result: candidateWithGaps,
      })
    );

    // Attention Flags rendered
    expect(html).toContain("Missing Required Skills");
    expect(html).toContain("Experience Below Required");
    expect(html).toContain("Semantic Scoring Unavailable");

    // Missing skills rendered as gap badges
    expect(html).toContain("Kubernetes");
    expect(html).toContain("Redis");
    expect(html).toContain("(Missing)");

    // Alias match indicator rendered (React.js -> React)
    expect(html).toContain("React.js → React");
  });

  it("4. loading/error/partial-result states behave correctly", async () => {
    // 1. API client error response handling
    const mockFailedFetch = async (): Promise<Response> => {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No candidate profiles provided for ranking.",
          code: "NO_CANDIDATES",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    };

    const apiResult = await rankScreeningCandidates(
      {
        jobDescription: { title: "Software Engineer", rawText: "Requirements: TypeScript" },
        candidates: [],
      },
      { fetchFn: mockFailedFetch as unknown as typeof fetch }
    );

    expect(apiResult.ok).toBe(false);
    if (!apiResult.ok) {
      expect(apiResult.code).toBe("NO_CANDIDATES");
      expect(apiResult.error).toContain("No candidate profiles provided");
    }

    // 2. Partial extraction + successful ranking UI representation
    const rankedCandidate = createMockRankingResult({
      rank: 1,
      candidateName: "Valid Candidate",
    });

    const failedDocumentResult: CandidateProcessingResult = {
      status: "error",
      document: {
        id: "doc_corrupt",
        fileName: "corrupt_resume.pdf",
        fileSizeBytes: 2048,
        mimeType: "application/pdf",
        uploadedAt: new Date().toISOString(),
        status: "error",
        errorMessage: "Corrupt PDF file header.",
      },
      warnings: [],
      error: "Corrupt PDF file header.",
    };

    const partialHtml = renderToString(
      React.createElement(CandidateResultsList, {
        results: [
          {
            status: "success",
            document: {
              id: "doc_1",
              fileName: "valid_resume.pdf",
              fileSizeBytes: 1024,
              mimeType: "application/pdf",
              uploadedAt: new Date().toISOString(),
              status: "parsed",
            },
            candidate: rankedCandidate.candidate,
            warnings: [],
          },
          failedDocumentResult,
        ],
        candidates: [rankedCandidate.candidate!],
        rankingResults: [rankedCandidate],
        warnings: [],
      })
    );

    // Ranked candidate card is displayed
    expect(partialHtml).toContain("Valid Candidate");
    expect(partialHtml).toContain("1 Ranked");

    // Ingestion issue section is displayed with failed file details
    expect(partialHtml).toContain("Resume Extraction Warnings &amp; Ingestion Issues");
    expect(partialHtml).toContain("corrupt_resume.pdf");
    expect(partialHtml).toContain("Corrupt PDF file header.");
  });
});
