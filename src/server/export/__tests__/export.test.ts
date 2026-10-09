import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { Candidate, RankingResult, RankingWeights } from "@/types";
import {
  exportService,
  csvExporterService,
  escapeCsvField,
  InvalidExportInputError,
} from "../index";

const mockWeights: RankingWeights = {
  requiredSkillsWeight: 50,
  semanticSimilarityWeight: 20,
  experienceWeight: 15,
  preferredSkillsWeight: 10,
  educationWeight: 5,
};

function createMockRankingResult(
  rank: number,
  name: string,
  score: number,
  overrides: Partial<RankingResult> = {}
): RankingResult {
  const candidate: Candidate = {
    id: `cand_${rank}`,
    documentId: `doc_${rank}`,
    fullName: name,
    skills: [{ name: "TypeScript" }, { name: "React" }],
    experiences: [],
    education: [],
  };

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
    missingSkills: ["Docker"],
    matchedRequiredSkills: ["TypeScript"],
    missingRequiredSkills: ["Docker"],
    matchedPreferredSkills: ["React"],
    matchedEducationRequirements: ["B.S. in Computer Science"],
    experienceEvaluation: {
      status: "meets",
      details: "5 years relevant experience",
      candidateYears: 5,
      requiredYears: 3,
    },
    appliedWeights: mockWeights,
    scoreBreakdown: {
      requiredSkillScore: 100,
      preferredSkillScore: 100,
      experienceScore: 100,
      educationScore: 100,
      semanticScore: 85.0,
    },
    semanticScore: 85.0,
    semanticAvailability: "available",
    matchAnalysis: {
      strength: score >= 85 ? "strong" : "good",
      overallScore: score,
      skillGap: {
        required: [],
        preferred: [],
        summary: {
          requiredCount: 2,
          requiredMatchedCount: 1,
          requiredMatchRate: 0.5,
          preferredCount: 1,
          preferredMatchedCount: 1,
          preferredMatchRate: 1,
          missingRequiredSkills: ["Docker"],
          missingPreferredSkills: [],
          summaryText: "Missing Docker.",
        },
      },
      experienceGap: {
        status: "meets",
        explanation: "Meets 3 yrs requirement.",
      },
      educationGap: {
        status: "meets",
        matchedRequirements: ["B.S. in Computer Science"],
        unmatchedRequirements: [],
        explanation: "Verified degree.",
      },
      semanticGap: {
        status: "available",
        score: 85.0,
        explanation: "High semantic alignment.",
      },
      explanation: {
        headline: `${score >= 85 ? "Strong" : "Good"} match (${score}%) against requirements.`,
        strongestAreas: ["Skills"],
        areasForImprovement: ["Docker"],
        detailedBulletPoints: ["Strong frontend foundation."],
      },
      attentionFlags: score < 80 ? ["missing-required-skills"] : [],
      analyzedAt: new Date().toISOString(),
    },
    explanations: [`Strong match (${score}%).`],
    summaryNotes: "Evaluated profile.",
    warnings: [],
    evaluatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Phase 3.9: Export Ranked Results", () => {
  it("1. CSV export contains ranked candidates in correct order and applied weights", async () => {
    const cand1 = createMockRankingResult(1, "Jane Doe", 92.5);
    const cand2 = createMockRankingResult(2, "John Smith", 76.0);

    const result = await exportService.exportResults({
      format: "csv",
      jobTitle: "Senior Frontend Engineer",
      rankingResults: [cand1, cand2],
    });

    expect(result.format).toBe("csv");
    expect(result.mimeType).toBe("text/csv; charset=utf-8");
    expect(result.filename).toMatch(/^smartranker-senior-frontend-engineer-.*\.csv$/);

    const csvText = Buffer.from(result.data).toString("utf8");

    // Applied weights present in export metadata/header
    expect(csvText).toContain("# Job Requisition: Senior Frontend Engineer");
    expect(csvText).toContain(
      "# Applied Ranking Weights: Required Skills (50%), Semantic Similarity (20%), Experience (15%), Preferred Skills (10%), Education (5%)"
    );

    // Columns present
    expect(csvText).toContain(
      "Rank,Candidate Name,Overall Score,Match Strength,Required Skills Matched,Required Skills Missing,Preferred Skills Matched,Experience Result,Education Result,Semantic Score,Attention Flags,Key Explanation"
    );

    // Preserves exact server ranking order
    const indexJane = csvText.indexOf("Jane Doe");
    const indexJohn = csvText.indexOf("John Smith");
    expect(indexJane).toBeGreaterThan(-1);
    expect(indexJohn).toBeGreaterThan(-1);
    expect(indexJane).toBeLessThan(indexJohn);

    // Content verified
    expect(csvText).toContain("1,Jane Doe,92.5%,STRONG,TypeScript,Docker,React");
    expect(csvText).toContain("2,John Smith,76.0%,GOOD,TypeScript,Docker,React");
  });

  it("2. CSV escaping works for commas, quotes, and newlines", () => {
    // Single field escaping tests
    expect(escapeCsvField("Plain")).toBe("Plain");
    expect(escapeCsvField("React, TypeScript")).toBe('"React, TypeScript"');
    expect(escapeCsvField('Lead "Staff" Dev')).toBe('"Lead ""Staff"" Dev"');
    expect(escapeCsvField("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
    expect(escapeCsvField("Line 1\r\nLine 2")).toBe('"Line 1\r\nLine 2"');
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");

    // Full export escaping integration
    const specialCand = createMockRankingResult(1, 'Smith, "Dr." John', 88.0, {
      matchedRequiredSkills: ["React, Native", "TypeScript"],
      matchAnalysis: {
        strength: "strong",
        overallScore: 88.0,
        skillGap: {
          required: [],
          preferred: [],
          summary: {
            requiredCount: 2,
            requiredMatchedCount: 2,
            requiredMatchRate: 1,
            preferredCount: 0,
            preferredMatchedCount: 0,
            preferredMatchRate: 1,
            missingRequiredSkills: [],
            missingPreferredSkills: [],
            summaryText: "Complete match.",
          },
        },
        experienceGap: { status: "meets", explanation: "Verified." },
        educationGap: { status: "meets", matchedRequirements: [], unmatchedRequirements: [], explanation: "Verified." },
        semanticGap: { status: "available", score: 85.0, explanation: "Aligned." },
        explanation: {
          headline: 'Strong fit with "cloud" skills;\nready to start.',
          strongestAreas: [],
          areasForImprovement: [],
          detailedBulletPoints: [],
        },
        attentionFlags: [],
        analyzedAt: new Date().toISOString(),
      },
    });

    const exportRes = csvExporterService.export(
      {
        format: "csv",
        jobTitle: 'VP, "Tech"',
        rankingResults: [specialCand],
      },
      "test.csv"
    );

    const text = Buffer.from(exportRes.data).toString("utf8");
    expect(text).toContain('"Smith, ""Dr."" John"');
    expect(text).toContain('"React, Native; TypeScript"');
    expect(text).toContain('"Strong fit with ""cloud"" skills;\nready to start."');
  });

  it("3. PDF export returns valid PDF output with expected report metadata", async () => {
    const cand1 = createMockRankingResult(1, "Alice Engineer", 95.0);
    const cand2 = createMockRankingResult(2, "Bob Developer", 82.0);

    const result = await exportService.exportResults({
      format: "pdf",
      jobTitle: "Principal Architect",
      rankingResults: [cand1, cand2],
    });

    expect(result.format).toBe("pdf");
    expect(result.mimeType).toBe("application/pdf");
    expect(result.filename).toMatch(/^smartranker-principal-architect-.*\.pdf$/);

    // Verify PDF header magic bytes (%PDF-)
    const buffer = Buffer.from(result.data);
    expect(buffer.slice(0, 5).toString("ascii")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1000);

    // Verify valid loadable PDF document with pages
    const parsedPdf = await PDFDocument.load(buffer);
    expect(parsedPdf.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("4. invalid/empty export input fails safely", async () => {
    // Missing payload
    await expect(
      exportService.exportResults(null as unknown as any)
    ).rejects.toThrow(InvalidExportInputError);

    // Empty ranking results array
    await expect(
      exportService.exportResults({
        format: "csv",
        rankingResults: [],
      })
    ).rejects.toThrow("No candidate ranking results provided for export.");

    // Unsupported format
    await expect(
      exportService.exportResults({
        format: "xlsx" as any,
        rankingResults: [createMockRankingResult(1, "Test", 80)],
      })
    ).rejects.toThrow("Unsupported export format 'xlsx'.");
  });
});
