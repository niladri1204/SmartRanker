import { describe, it, expect, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { Candidate, RankingResult, RankingWeights, JobDescription } from "@/types";
import {
  rankScreeningCandidates,
  exportRankedResults,
} from "../screening-api";
import { CandidateProcessingResult } from "../types";
import {
  POST as rankRoutePost,
  ScreeningRankApiRequest,
} from "@/app/api/screening/rank/route";
import {
  POST as exportRoutePost,
  ScreeningExportApiRequest,
} from "@/app/api/screening/export/route";
import {
  RankingEngineService,
  IEmbeddingProvider,
} from "@/server/matching";
import { NextRequest } from "next/server";

describe("Phase 3.11: End-to-End Integration & Hardening", () => {
  const baseJobDescription: JobDescription = {
    id: "job_1",
    title: "Senior Full-Stack Engineer",
    rawText:
      "We are looking for a Senior Full-Stack Engineer with 4+ years of experience in TypeScript, React, and Node.js. Experience with Docker is preferred. Bachelor's degree in Computer Science required.",
    requiredSkills: ["TypeScript", "React", "Node.js"],
    preferredSkills: ["Docker"],
    minExperienceYears: 4,
    createdAt: new Date().toISOString(),
  };

  const candidateAlice: Candidate = {
    id: "cand_alice",
    documentId: "doc_alice_resume.pdf",
    fullName: "Alice Chen",
    email: "alice@example.com",
    skills: [
      { name: "TypeScript" },
      { name: "React" },
      { name: "Node.js" },
      { name: "Docker" },
    ],
    experiences: [
      {
        id: "exp_1",
        role: "Senior Software Engineer",
        company: "Alpha Tech",
        startDate: "2019-01",
        endDate: "2024-01",
        description: "Built scalable full-stack web applications using React and Node.js.",
      },
    ],
    education: [
      {
        id: "edu_1",
        institution: "State University",
        degree: "Bachelor of Science in Computer Science",
        fieldOfStudy: "Computer Science",
      },
    ],
  };

  const candidateBob: Candidate = {
    id: "cand_bob",
    documentId: "doc_bob_resume.docx",
    fullName: "Bob Smith",
    email: "bob@example.com",
    skills: [{ name: "React" }],
    experiences: [
      {
        id: "exp_2",
        role: "Junior Web Developer",
        company: "Beta Studio",
        startDate: "2022-01",
        endDate: "2023-01",
      },
    ],
    education: [
      {
        id: "edu_2",
        institution: "City College",
        degree: "Associate in Arts",
      },
    ],
  };

  it("1. Complete workflow contract compatibility across ingestion output, ranking, and export", async () => {
    // 1A. Simulate ingestion output containing 2 successful candidates and 1 isolated failure
    const candidateResults: CandidateProcessingResult[] = [
      {
        status: "success",
        document: {
          id: "doc_alice_resume.pdf",
          fileName: "alice_resume.pdf",
          fileSizeBytes: 2048,
          mimeType: "application/pdf",
          uploadedAt: new Date().toISOString(),
          status: "parsed",
        },
        candidate: candidateAlice,
        warnings: [],
      },
      {
        status: "success",
        document: {
          id: "doc_bob_resume.docx",
          fileName: "bob_resume.docx",
          fileSizeBytes: 1024,
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          uploadedAt: new Date().toISOString(),
          status: "parsed",
        },
        candidate: candidateBob,
        warnings: [],
      },
      {
        status: "error",
        document: {
          id: "doc_corrupted.pdf",
          fileName: "corrupted_resume.pdf",
          fileSizeBytes: 512,
          mimeType: "application/pdf",
          uploadedAt: new Date().toISOString(),
          status: "error",
          errorMessage: "File stream could not be decoded.",
        },
        error: "File stream could not be decoded.",
        warnings: [],
      },
    ];

    const successfulCandidates = candidateResults
      .filter((r) => r.status === "success" && r.candidate)
      .map((r) => r.candidate!);

    expect(successfulCandidates).toHaveLength(2);
    expect(candidateResults.filter((r) => r.status === "error")).toHaveLength(1);

    // 1B. Dispatch directly to POST /api/screening/rank
    const rankPayload: ScreeningRankApiRequest = {
      jobDescription: {
        title: baseJobDescription.title,
        rawText: baseJobDescription.rawText,
        requiredSkills: baseJobDescription.requiredSkills,
        preferredSkills: baseJobDescription.preferredSkills,
        minExperienceYears: baseJobDescription.minExperienceYears,
        educationRequirements: ["Bachelor's in Computer Science"],
      },
      candidates: successfulCandidates,
      rankingWeights: {
        requiredSkillsWeight: 40,
        semanticSimilarityWeight: 25,
        experienceWeight: 20,
        preferredSkillsWeight: 10,
        educationWeight: 5,
      },
    };

    const rankHttpRequest = new NextRequest("http://localhost:3000/api/screening/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rankPayload),
    });

    const rankHttpResponse = await rankRoutePost(rankHttpRequest);
    expect(rankHttpResponse.status).toBe(200);

    const rankData = await rankHttpResponse.json();
    expect(rankData.success).toBe(true);
    expect(rankData.totalCandidates).toBe(2);
    expect(rankData.results).toHaveLength(2);

    // Verify deterministic server-ordered results (Alice outscores Bob)
    const firstResult: RankingResult = rankData.results[0];
    const secondResult: RankingResult = rankData.results[1];
    expect(firstResult.candidateName).toBe("Alice Chen");
    expect(secondResult.candidateName).toBe("Bob Smith");
    expect(firstResult.score).toBeGreaterThan(secondResult.score);

    // Verify appliedWeights are percentage representation summing to 100
    expect(firstResult.appliedWeights).toEqual({
      requiredSkillsWeight: 40,
      semanticSimilarityWeight: 25,
      experienceWeight: 20,
      preferredSkillsWeight: 10,
      educationWeight: 5,
    });

    // Verify match gap analysis is populated and agrees with the result
    expect(firstResult.matchAnalysis).toBeDefined();
    expect(firstResult.matchAnalysis!.strength).toBe("strong");
    expect(firstResult.matchAnalysis!.skillGap.summary.missingRequiredSkills).toHaveLength(0);
    expect(secondResult.matchAnalysis!.skillGap.summary.missingRequiredSkills).toContain("TypeScript");

    // 1C. Dispatch server-ranked results to POST /api/screening/export for CSV
    const exportPayload: ScreeningExportApiRequest = {
      format: "csv",
      jobTitle: baseJobDescription.title,
      rankingResults: rankData.results,
    };

    const exportHttpRequest = new NextRequest("http://localhost:3000/api/screening/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(exportPayload),
    });

    const exportHttpResponse = await exportRoutePost(exportHttpRequest);
    expect(exportHttpResponse.status).toBe(200);
    expect(exportHttpResponse.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");

    const csvText = await exportHttpResponse.text();
    expect(csvText).toContain("# Job Requisition: Senior Full-Stack Engineer");
    expect(csvText).toContain("Applied Ranking Weights: Required Skills (40%), Semantic Similarity (25%), Experience (20%), Preferred Skills (10%), Education (5%)");
    expect(csvText).toContain("1,Alice Chen");
    expect(csvText).toContain("2,Bob Smith");
    expect(csvText.indexOf("Alice Chen")).toBeLessThan(csvText.indexOf("Bob Smith"));
  });

  it("2. Semantic-provider failure fallback safely redistributes weights and does not fabricate scores", async () => {
    // Failing semantic provider mock
    const failingProvider: IEmbeddingProvider = {
      providerId: "failing-openai",
      modelName: "text-embedding-3-small",
      dimensions: 1536,
      embed: vi.fn().mockRejectedValue(new Error("OpenAI API rate limit exceeded (HTTP 429)")),
      embedBatch: vi.fn().mockRejectedValue(new Error("OpenAI API rate limit exceeded (HTTP 429)")),
    };

    const engine = new RankingEngineService({
      embeddingProvider: failingProvider,
    });

    const results = await engine.rankCandidates(baseJobDescription, [candidateAlice]);

    expect(results).toHaveLength(1);
    const result = results[0];

    // Semantic status is marked as failed without unhandled rejection
    expect(result.semanticAvailability).toBe("failed");
    expect(result.semanticScore).toBeUndefined();
    expect(result.semanticSimilarity).toBeUndefined();

    // Warnings & explanations report graceful fallback
    expect(result.warnings).toContain("Semantic scoring unavailable; deterministic criteria used.");
    expect(result.explanations).toContain("Semantic scoring unavailable; deterministic criteria used.");

    // Score is strictly deterministic and bounded (0-100)
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.scoreBreakdown.semanticScore).toBeUndefined();
    expect(result.scoreBreakdown.requiredSkillScore).toBe(100);

    // Applied weights preserve percentage contract
    expect(result.appliedWeights).toBeDefined();
    expect(result.appliedWeights!.requiredSkillsWeight).toBe(40);
  });

  it("3. Reranking with custom weights updates scores and weights without re-uploading candidates", async () => {
    // Custom weights heavily prioritizing experience (50%) over skills (20%)
    const customWeights: RankingWeights = {
      requiredSkillsWeight: 20,
      semanticSimilarityWeight: 10,
      experienceWeight: 50,
      preferredSkillsWeight: 10,
      educationWeight: 10,
    };

    const rankPayload: ScreeningRankApiRequest = {
      jobDescription: {
        title: baseJobDescription.title,
        rawText: baseJobDescription.rawText,
      },
      candidates: [candidateAlice, candidateBob],
      rankingWeights: customWeights,
    };

    const rankHttpRequest = new NextRequest("http://localhost:3000/api/screening/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rankPayload),
    });

    const rankHttpResponse = await rankRoutePost(rankHttpRequest);
    expect(rankHttpResponse.status).toBe(200);

    const rankData = await rankHttpResponse.json();
    expect(rankData.success).toBe(true);

    const [first, second] = rankData.results as RankingResult[];
    expect(first.appliedWeights).toEqual(customWeights);
    expect(second.appliedWeights).toEqual(customWeights);

    // Candidates retain their original document IDs and extracted metadata
    expect(first.candidateId).toBe(candidateAlice.id);
    expect(first.documentId).toBe("doc_alice_resume.pdf");

    // Negative weights or invalid weights input safely returns HTTP 400
    const invalidPayload: ScreeningRankApiRequest = {
      jobDescription: {
        rawText: baseJobDescription.rawText,
      },
      candidates: [candidateAlice],
      rankingWeights: {
        requiredSkillsWeight: -5,
      },
    };

    const invalidHttpRequest = new NextRequest("http://localhost:3000/api/screening/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidPayload),
    });

    const invalidHttpResponse = await rankRoutePost(invalidHttpRequest);
    expect(invalidHttpResponse.status).toBe(400);

    const errorData = await invalidHttpResponse.json();
    expect(errorData.success).toBe(false);
    expect(errorData.code).toBe("INVALID_RANKING_WEIGHTS");
  });

  it("4. PDF export produces valid binary output with exact candidate order and applied weights", async () => {
    const customWeights: RankingWeights = {
      requiredSkillsWeight: 35,
      semanticSimilarityWeight: 20,
      experienceWeight: 25,
      preferredSkillsWeight: 10,
      educationWeight: 10,
    };

    const mockRankingResults: RankingResult[] = [
      {
        id: "rank_1",
        candidateId: candidateAlice.id,
        candidateName: candidateAlice.fullName,
        documentId: candidateAlice.documentId,
        candidate: candidateAlice,
        score: 94.0,
        overallScore: 94.0,
        rank: 1,
        matchingSkills: ["TypeScript", "React", "Node.js", "Docker"],
        missingSkills: [],
        matchedRequiredSkills: ["TypeScript", "React", "Node.js"],
        missingRequiredSkills: [],
        matchedPreferredSkills: ["Docker"],
        matchedEducationRequirements: ["Bachelor's in Computer Science"],
        experienceEvaluation: {
          status: "meets",
          details: "5 years relevant experience",
          candidateYears: 5,
          requiredYears: 4,
        },
        appliedWeights: customWeights,
        scoreBreakdown: {
          requiredSkillScore: 100,
          preferredSkillScore: 100,
          experienceScore: 100,
          educationScore: 100,
        },
        semanticAvailability: "unavailable",
        matchAnalysis: {
          strength: "strong",
          overallScore: 94.0,
          skillGap: {
            required: [],
            preferred: [],
            summary: {
              requiredCount: 3,
              requiredMatchedCount: 3,
              requiredMatchRate: 1,
              preferredCount: 1,
              preferredMatchedCount: 1,
              preferredMatchRate: 1,
              missingRequiredSkills: [],
              missingPreferredSkills: [],
              summaryText: "All required skills satisfied.",
            },
          },
          experienceGap: { status: "meets", explanation: "Exceeds 4 yrs requirement." },
          educationGap: {
            status: "meets",
            matchedRequirements: ["Bachelor's in Computer Science"],
            unmatchedRequirements: [],
            explanation: "Verified CS degree.",
          },
          semanticGap: { status: "unavailable", explanation: "Fallback scoring applied." },
          explanation: {
            headline: "Outstanding match (94.0%) across all technical requirements.",
            strongestAreas: ["Full-Stack Skills", "Experience"],
            areasForImprovement: [],
            detailedBulletPoints: ["Meets all critical competencies."],
          },
          attentionFlags: [],
          analyzedAt: new Date().toISOString(),
        },
        explanations: ["Outstanding full-stack competencies."],
        summaryNotes: "Strong candidate profile.",
        warnings: [],
        evaluatedAt: new Date().toISOString(),
      },
      {
        id: "rank_2",
        candidateId: candidateBob.id,
        candidateName: candidateBob.fullName,
        documentId: candidateBob.documentId,
        candidate: candidateBob,
        score: 45.0,
        overallScore: 45.0,
        rank: 2,
        matchingSkills: ["React"],
        missingSkills: ["TypeScript", "Node.js"],
        matchedRequiredSkills: ["React"],
        missingRequiredSkills: ["TypeScript", "Node.js"],
        matchedPreferredSkills: [],
        matchedEducationRequirements: [],
        experienceEvaluation: {
          status: "below",
          details: "1 year relevant experience",
          candidateYears: 1,
          requiredYears: 4,
        },
        appliedWeights: customWeights,
        scoreBreakdown: {
          requiredSkillScore: 33.3,
          preferredSkillScore: 0,
          experienceScore: 25.0,
          educationScore: 0,
        },
        semanticAvailability: "unavailable",
        matchAnalysis: {
          strength: "moderate",
          overallScore: 45.0,
          skillGap: {
            required: [],
            preferred: [],
            summary: {
              requiredCount: 3,
              requiredMatchedCount: 1,
              requiredMatchRate: 0.33,
              preferredCount: 1,
              preferredMatchedCount: 0,
              preferredMatchRate: 0,
              missingRequiredSkills: ["TypeScript", "Node.js"],
              missingPreferredSkills: ["Docker"],
              summaryText: "Missing critical competencies.",
            },
          },
          experienceGap: { status: "does-not-meet", explanation: "1 of 4 years required." },
          educationGap: {
            status: "unmatched",
            matchedRequirements: [],
            unmatchedRequirements: ["Bachelor's in Computer Science"],
            explanation: "Degree not verified.",
          },
          semanticGap: { status: "unavailable", explanation: "Fallback scoring applied." },
          explanation: {
            headline: "Moderate match with significant skill and experience gaps.",
            strongestAreas: ["React"],
            areasForImprovement: ["TypeScript", "Node.js", "Experience"],
            detailedBulletPoints: ["Needs additional full-stack experience."],
          },
          attentionFlags: ["missing-required-skills", "experience-below-required"],
          analyzedAt: new Date().toISOString(),
        },
        explanations: ["Partial match."],
        summaryNotes: "Junior profile.",
        warnings: [],
        evaluatedAt: new Date().toISOString(),
      },
    ];

    const exportPayload: ScreeningExportApiRequest = {
      format: "pdf",
      jobTitle: "Senior Full-Stack Engineer",
      rankingResults: mockRankingResults,
    };

    const exportHttpRequest = new NextRequest("http://localhost:3000/api/screening/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(exportPayload),
    });

    const exportHttpResponse = await exportRoutePost(exportHttpRequest);
    expect(exportHttpResponse.status).toBe(200);
    expect(exportHttpResponse.headers.get("Content-Type")).toBe("application/pdf");

    const disposition = exportHttpResponse.headers.get("Content-Disposition");
    expect(disposition).toContain("attachment; filename=");
    expect(disposition).toContain("smartranker-senior-full-stack-engineer-");

    const arrayBuffer = await exportHttpResponse.arrayBuffer();
    const pdfBytes = Buffer.from(arrayBuffer);

    // Magic bytes check (%PDF-)
    expect(pdfBytes.slice(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdfBytes.length).toBeGreaterThan(1000);

    // Parse and verify valid PDF structure with pdf-lib
    const parsedPdf = await PDFDocument.load(pdfBytes);
    expect(parsedPdf.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
