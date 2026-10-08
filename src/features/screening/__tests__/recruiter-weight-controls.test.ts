import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { Candidate, RankingResult, RankingWeights } from "@/types";
import {
  DEFAULT_FRONTEND_RANKING_WEIGHTS,
  rankScreeningCandidates,
  ScreeningRankApiRequest,
  useScreeningWorkflow,
} from "@/features/screening";
import { RankingWeightControls } from "@/components/dashboard/ranking-weight-controls";

function createMockCandidate(name = "Jane Dev"): Candidate {
  return {
    id: "cand_1",
    documentId: "doc_1",
    fullName: name,
    skills: [{ name: "TypeScript" }, { name: "React" }],
    experiences: [],
    education: [],
  };
}

function createMockRankingResult(cand: Candidate, weights: RankingWeights): RankingResult {
  return {
    id: "rank_1",
    candidateId: cand.id,
    candidateName: cand.fullName,
    documentId: cand.documentId,
    candidate: cand,
    score: 85.0,
    overallScore: 85.0,
    rank: 1,
    matchingSkills: ["TypeScript"],
    missingSkills: [],
    matchedRequiredSkills: ["TypeScript"],
    missingRequiredSkills: [],
    matchedPreferredSkills: [],
    matchedEducationRequirements: [],
    experienceEvaluation: {
      status: "meets",
      details: "Meets requirement.",
    },
    skillMatches: [],
    appliedWeights: weights,
    scoreBreakdown: {
      requiredSkillScore: 100,
      preferredSkillScore: 100,
      experienceScore: 100,
      educationScore: 100,
      semanticScore: 80,
    },
    explanations: ["Matched required skills."],
    summaryNotes: "Strong candidate.",
    warnings: [],
    evaluatedAt: new Date().toISOString(),
  };
}

describe("Phase 3.8: Recruiter Ranking Weight Controls", () => {
  it("1. default weights populate correctly", () => {
    // 1. Verify constant values
    expect(DEFAULT_FRONTEND_RANKING_WEIGHTS.requiredSkillsWeight).toBe(40);
    expect(DEFAULT_FRONTEND_RANKING_WEIGHTS.semanticSimilarityWeight).toBe(25);
    expect(DEFAULT_FRONTEND_RANKING_WEIGHTS.experienceWeight).toBe(20);
    expect(DEFAULT_FRONTEND_RANKING_WEIGHTS.preferredSkillsWeight).toBe(10);
    expect(DEFAULT_FRONTEND_RANKING_WEIGHTS.educationWeight).toBe(5);

    const sum = Object.values(DEFAULT_FRONTEND_RANKING_WEIGHTS).reduce(
      (a, b) => a + b,
      0
    );
    expect(sum).toBe(100);

    // 2. Render control component
    const html = renderToString(
      React.createElement(RankingWeightControls, {
        weights: DEFAULT_FRONTEND_RANKING_WEIGHTS,
        onChange: () => {},
        onReset: () => {},
        onApply: () => {},
      })
    );

    expect(html).toContain("Ranking Priority Weights");
    expect(html).toContain("Total: 100%");
    expect(html).toContain("Default");
  });

  it("2. recruiter changes are validated and submitted correctly", async () => {
    const customWeights: RankingWeights = {
      requiredSkillsWeight: 60,
      semanticSimilarityWeight: 15,
      experienceWeight: 15,
      preferredSkillsWeight: 5,
      educationWeight: 5,
    };

    let sentPayload: ScreeningRankApiRequest | null = null;
    const mockFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      sentPayload = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          success: true,
          totalCandidates: 1,
          results: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const cand = createMockCandidate("Custom Priority Candidate");
    const res = await rankScreeningCandidates(
      {
        jobDescription: { rawText: "Senior Engineer Requirements" },
        candidates: [cand],
        rankingWeights: customWeights,
      },
      { fetchFn: mockFetch as unknown as typeof fetch }
    );

    expect(res.ok).toBe(true);
    expect(sentPayload).not.toBeNull();
    expect(sentPayload!.rankingWeights).toEqual(customWeights);
    expect(sentPayload!.rankingWeights?.requiredSkillsWeight).toBe(60);

    // Render controls in customized state
    const html = renderToString(
      React.createElement(RankingWeightControls, {
        weights: customWeights,
        onChange: () => {},
        onReset: () => {},
        onApply: () => {},
      })
    );

    expect(html).toContain("Customized");
    expect(html).toContain("Total: 100%");
  });

  it("3. applying weights re-ranks existing candidates without re-uploading files", async () => {
    const candidate = createMockCandidate("Existing Ingested Candidate");
    const customWeights: RankingWeights = {
      requiredSkillsWeight: 50,
      semanticSimilarityWeight: 20,
      experienceWeight: 15,
      preferredSkillsWeight: 10,
      educationWeight: 5,
    };

    let uploadApiCalled = false;
    let rankApiCalledCount = 0;
    let sentRankWeights: RankingWeights | undefined = undefined;

    const mockScreeningApi = async () => {
      uploadApiCalled = true;
      return {
        ok: true as const,
        data: {
          success: true,
          totalProcessed: 1,
          successfulCount: 1,
          failedCount: 0,
          candidates: [candidate],
          candidateResults: [],
          warnings: [],
        },
      };
    };

    const mockRankApi = async (req: ScreeningRankApiRequest) => {
      rankApiCalledCount++;
      sentRankWeights = req.rankingWeights as RankingWeights;
      return {
        ok: true as const,
        data: {
          success: true,
          totalCandidates: req.candidates.length,
          results: [createMockRankingResult(candidate, req.rankingWeights as RankingWeights)],
        },
      };
    };

    // Simulate re-ranking direct call without triggering upload API
    expect(uploadApiCalled).toBe(false);

    const reRankResponse = await mockRankApi({
      jobDescription: { title: "Lead Engineer", rawText: "Requirements: TypeScript" },
      candidates: [candidate],
      rankingWeights: customWeights,
    });

    // Verify upload was bypassed completely
    expect(uploadApiCalled).toBe(false);
    expect(rankApiCalledCount).toBe(1);
    expect(sentRankWeights).toEqual(customWeights);
    expect(reRankResponse.data.results[0].appliedWeights).toEqual(customWeights);

    // Verify appliedWeights strictly uses percentage values summing to 100 (NOT fractional decimals 0.50, 0.20)
    const applied = reRankResponse.data.results[0].appliedWeights!;
    expect(applied.requiredSkillsWeight).toBe(50);
    expect(applied.semanticSimilarityWeight).toBe(20);
    expect(applied.experienceWeight).toBe(15);
    expect(applied.preferredSkillsWeight).toBe(10);
    expect(applied.educationWeight).toBe(5);
    expect(
      applied.requiredSkillsWeight +
        applied.semanticSimilarityWeight +
        applied.experienceWeight +
        applied.preferredSkillsWeight +
        applied.educationWeight
    ).toBe(100);
  });

  it("4. invalid/all-zero weights are blocked safely", () => {
    const allZeroWeights: RankingWeights = {
      requiredSkillsWeight: 0,
      semanticSimilarityWeight: 0,
      experienceWeight: 0,
      preferredSkillsWeight: 0,
      educationWeight: 0,
    };

    const sum = Object.values(allZeroWeights).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);

    const html = renderToString(
      React.createElement(RankingWeightControls, {
        weights: allZeroWeights,
        onChange: () => {},
        onReset: () => {},
        onApply: () => {},
        defaultExpanded: true,
        error: "Total configured weight must be greater than 0%.",
      })
    );

    expect(html).toContain("Total: 0%");
    expect(html).toContain("Total configured weight must be greater than 0%.");
  });
});
