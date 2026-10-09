import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { Candidate, RankingResult, RankingWeights } from "@/types";
import { CandidateResultsList } from "@/components/dashboard/candidate-results-list";
import { CandidateComparisonModal } from "@/components/dashboard/candidate-comparison-modal";

const mockWeights: RankingWeights = {
  requiredSkillsWeight: 40,
  semanticSimilarityWeight: 25,
  experienceWeight: 20,
  preferredSkillsWeight: 10,
  educationWeight: 5,
};

function createMockCandidate(id: string, name: string): Candidate {
  return {
    id,
    documentId: `${id}.pdf`,
    fullName: name,
    skills: [{ name: "TypeScript" }, { name: "React" }],
    experiences: [],
    education: [],
  };
}

function createMockRankingResult(
  rank: number,
  id: string,
  name: string,
  score: number,
  overrides: Partial<RankingResult> = {}
): RankingResult {
  const candidate = createMockCandidate(id, name);
  return {
    id: `rank_${rank}`,
    candidateId: candidate.id,
    candidateName: candidate.fullName,
    documentId: candidate.documentId,
    candidate,
    score,
    overallScore: score,
    rank,
    matchingSkills: ["TypeScript", "React"],
    missingSkills: [],
    matchedRequiredSkills: ["TypeScript", "React"],
    missingRequiredSkills: [],
    matchedPreferredSkills: ["GraphQL"],
    matchedEducationRequirements: ["B.S. in Computer Science"],
    experienceEvaluation: {
      status: "meets",
      details: "5 years experience",
      candidateYears: 5,
      requiredYears: 3,
    },
    skillMatches: [
      {
        candidateSkill: "React.js",
        jobSkill: "React",
        canonicalId: "react",
        canonicalName: "React",
        isAliasMatch: true,
      },
    ],
    appliedWeights: mockWeights,
    scoreBreakdown: {
      requiredSkillScore: 100,
      preferredSkillScore: 90,
      experienceScore: 100,
      educationScore: 100,
      semanticScore: 88.0,
    },
    semanticScore: 88.0,
    semanticSimilarity: 0.852,
    semanticAvailability: "available",
    matchAnalysis: {
      strength: score >= 85 ? "strong" : "good",
      overallScore: score,
      skillGap: {
        required: [],
        preferred: [],
        summary: {
          requiredCount: 2,
          requiredMatchedCount: 2,
          requiredMatchRate: 1,
          preferredCount: 1,
          preferredMatchedCount: 1,
          preferredMatchRate: 1,
          missingRequiredSkills: [],
          missingPreferredSkills: [],
          summaryText: "All skills satisfied.",
        },
      },
      experienceGap: {
        status: "meets",
        candidateYears: 5,
        requiredYears: 3,
        explanation: "Meets 3 yrs requirement.",
      },
      educationGap: {
        status: "meets",
        matchedRequirements: ["B.S. in Computer Science"],
        unmatchedRequirements: [],
        explanation: "Verified B.S. degree.",
      },
      semanticGap: {
        status: "available",
        score: 88.0,
        explanation: "Strong semantic alignment.",
      },
      explanation: {
        headline: `${score >= 85 ? "Strong" : "Good"} candidate match against job requirements.`,
        strongestAreas: ["Technical Skills", "Experience"],
        areasForImprovement: ["Cloud certifications"],
        detailedBulletPoints: ["Strong frontend foundation."],
      },
      attentionFlags: [],
      analyzedAt: new Date().toISOString(),
    },
    explanations: ["Strong match."],
    summaryNotes: "Top profile.",
    warnings: [],
    evaluatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function isButtonDisabled(html: string, testId: string): boolean {
  const match = html.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>`, "i"));
  if (!match) return false;
  return match[0].includes('disabled=""') || match[0].startsWith('<button disabled');
}

describe("Phase 3.10: Side-by-Side Candidate Comparison", () => {
  const cand1 = createMockRankingResult(1, "cand_1", "Jane Doe", 94.0);
  const cand2 = createMockRankingResult(2, "cand_2", "Bob Smith", 82.5, {
    missingRequiredSkills: ["Docker"],
    semanticScore: undefined,
    semanticAvailability: "unavailable",
    scoreBreakdown: {
      requiredSkillScore: 80,
      preferredSkillScore: 70,
      experienceScore: 90,
      educationScore: 100,
      semanticScore: undefined,
    },
  });
  const cand3 = createMockRankingResult(3, "cand_3", "Charlie Brown", 71.0, {
    missingRequiredSkills: ["AWS", "Docker"],
  });
  const cand4 = createMockRankingResult(4, "cand_4", "Diana Prince", 65.0);

  const mockResults = [cand1, cand2, cand3, cand4];

  it("1. Selecting two candidates enables comparison; one candidate does not", () => {
    // 0 candidates selected -> button disabled
    const html0 = renderToString(
      React.createElement(CandidateResultsList, {
        results: [],
        candidates: mockResults.map((r) => r.candidate!),
        rankingResults: mockResults,
        warnings: [],
        selectedCandidateIds: [],
      })
    );
    expect(html0).toContain("Compare (0/3)");
    expect(isButtonDisabled(html0, "open-comparison-button")).toBe(true);

    // 1 candidate selected -> button still disabled
    const html1 = renderToString(
      React.createElement(CandidateResultsList, {
        results: [],
        candidates: mockResults.map((r) => r.candidate!),
        rankingResults: mockResults,
        warnings: [],
        selectedCandidateIds: ["cand_1"],
      })
    );
    expect(html1).toContain("Compare (1/3)");
    expect(isButtonDisabled(html1, "open-comparison-button")).toBe(true);

    // 2 candidates selected -> button enabled
    const html2 = renderToString(
      React.createElement(CandidateResultsList, {
        results: [],
        candidates: mockResults.map((r) => r.candidate!),
        rankingResults: mockResults,
        warnings: [],
        selectedCandidateIds: ["cand_1", "cand_2"],
      })
    );
    expect(html2).toContain("Compare (2/3)");
    expect(isButtonDisabled(html2, "open-comparison-button")).toBe(false);

    // 3 candidates selected -> button enabled
    const html3 = renderToString(
      React.createElement(CandidateResultsList, {
        results: [],
        candidates: mockResults.map((r) => r.candidate!),
        rankingResults: mockResults,
        warnings: [],
        selectedCandidateIds: ["cand_1", "cand_2", "cand_3"],
      })
    );
    expect(html3).toContain("Compare (3/3)");
    expect(isButtonDisabled(html3, "open-comparison-button")).toBe(false);
  });

  it("2. The modal displays the selected candidates and their existing ranking details", () => {
    const html = renderToString(
      React.createElement(CandidateComparisonModal, {
        isOpen: true,
        onClose: () => {},
        candidates: [cand1, cand2],
      })
    );

    // Modal title & container
    expect(html).toContain("Side-by-Side Candidate Comparison");
    expect(html).toContain("2 Candidates");

    // Both candidate columns displayed in server order
    expect(html).toContain('data-testid="comparison-column-1"');
    expect(html).toContain('data-testid="comparison-column-2"');
    expect(html).toContain("Jane Doe");
    expect(html).toContain("Bob Smith");

    // Exact overall scores
    expect(html).toContain("94.0%");
    expect(html).toContain("82.5%");

    // Match strengths
    expect(html).toContain("STRONG MATCH");
    expect(html).toContain("GOOD MATCH");

    // Dimension breakdown & weights
    expect(html).toContain("Dimension Scores");
    expect(html).toContain("Required Skills");
    expect(html).toContain("Semantic Relevance");
    expect(html).toContain("Experience");

    // Distinguishes unavailable semantic score from zero
    expect(html).toContain("88.0%");
    expect(html).toContain("Unavailable");

    // Canonical alias displayed
    expect(html).toContain("(via React.js)");

    // Missing skills
    expect(html).toContain("Docker");
    expect(html).toContain("None (All Matched)");

    // Match-gap areas
    expect(html).toContain("Technical Skills");
    expect(html).toContain("Cloud certifications");
  });

  it("3. Removing a candidate and closing the modal work correctly", () => {
    // When closed, modal renders nothing
    const closedHtml = renderToString(
      React.createElement(CandidateComparisonModal, {
        isOpen: false,
        onClose: () => {},
        candidates: [cand1, cand2],
      })
    );
    expect(closedHtml).toBe("");

    // When open, close button and candidate remove buttons are present
    const openHtml = renderToString(
      React.createElement(CandidateComparisonModal, {
        isOpen: true,
        onClose: () => {},
        candidates: [cand1, cand2],
        onRemoveCandidate: () => {},
      })
    );
    expect(openHtml).toContain('data-testid="close-comparison-modal"');
    expect(openHtml).toContain('data-testid="remove-candidate-btn-1"');
    expect(openHtml).toContain('data-testid="remove-candidate-btn-2"');
  });

  it("4. Selecting more than three candidates is prevented", () => {
    // 3 candidates selected -> cand_4's compare button is disabled
    const html = renderToString(
      React.createElement(CandidateResultsList, {
        results: [],
        candidates: mockResults.map((r) => r.candidate!),
        rankingResults: mockResults,
        warnings: [],
        selectedCandidateIds: ["cand_1", "cand_2", "cand_3"],
      })
    );

    // Selected candidates show "✓ Selected to Compare" and are enabled
    expect(html).toContain('data-testid="compare-candidate-button-1"');
    expect(html).toContain("✓ Selected to Compare");

    // 4th unselected candidate's compare button has disabled attribute
    expect(isButtonDisabled(html, "compare-candidate-button-4")).toBe(true);
  });
});
