import { describe, it, expect } from "vitest";
import { escapeCsvField } from "../csv-exporter.service";
import { exportService } from "../export.service";
import { InvalidExportInputError } from "../export.types";
import { RankingEngineService } from "@/server/matching";
import { Candidate, RankingWeights, JobDescription, RankingResult } from "@/types";
import { POST as rankRoutePost } from "@/app/api/screening/rank/route";

describe("Phase 4.1: Production Readiness Security & Robustness", () => {
  it("1. mitigates CSV formula injection (CWE-1236) by neutralizing formula trigger characters", () => {
    // Malicious formula payloads targeting spreadsheet execution
    expect(escapeCsvField("=SUM(1+1)")).toBe("'=SUM(1+1)");
    expect(escapeCsvField("=cmd|'/C calc'!A0")).toBe("'=cmd|'/C calc'!A0");
    expect(escapeCsvField('=cmd|"/C calc"!A0')).toBe('"\'=cmd|\"\"\/C calc\"\"!A0"'.replace(/\\/g, "\\"));
    expect(escapeCsvField("@evil_lookup")).toBe("'@evil_lookup");
    expect(escapeCsvField("+1-555-0100")).toBe("'+1-555-0100");
    expect(escapeCsvField("-Candidate lacks required skills")).toBe(
      "'-Candidate lacks required skills"
    );
    expect(escapeCsvField("\tTabPrefixed")).toBe("'\tTabPrefixed");

    // Legitimate numbers, ranks, and percentages must not be broken or quoted
    expect(escapeCsvField(1)).toBe("1");
    expect(escapeCsvField(100)).toBe("100");
    expect(escapeCsvField(-5)).toBe("-5");
    expect(escapeCsvField("95.5%")).toBe("95.5%");
    expect(escapeCsvField("0.0%")).toBe("0.0%");

    // Standard text
    expect(escapeCsvField("Alice Chen")).toBe("Alice Chen");
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });

  it("2. safely ranks candidates with undefined or missing full names without throwing in tie-breaking", async () => {
    const engine = new RankingEngineService();

    const mockJob: JobDescription = {
      id: "job_sec_1",
      title: "Backend Engineer",
      rawText: "Requires TypeScript and PostgreSQL.",
      requiredSkills: ["TypeScript", "PostgreSQL"],
      createdAt: new Date().toISOString(),
    };

    // Candidates with undefined / empty names and identical scores to trigger name-based tie-breaking
    const cand1: Candidate = {
      id: "cand_no_name_1",
      documentId: "doc_1",
      fullName: undefined as unknown as string,
      skills: [{ name: "TypeScript" }, { name: "PostgreSQL" }],
      experiences: [],
      education: [],
    };

    const cand2: Candidate = {
      id: "cand_no_name_2",
      documentId: "doc_2",
      fullName: "",
      skills: [{ name: "TypeScript" }, { name: "PostgreSQL" }],
      experiences: [],
      education: [],
    };

    const weights: RankingWeights = {
      requiredSkillsWeight: 100,
      semanticSimilarityWeight: 0,
      experienceWeight: 0,
      preferredSkillsWeight: 0,
      educationWeight: 0,
    };

    const results = await engine.rankCandidates(mockJob, [cand1, cand2], {
      rankingWeights: weights,
      embeddingProvider: null,
    });

    expect(results).toHaveLength(2);
    expect(results[0].score).toBe(100);
    expect(results[1].score).toBe(100);
    expect(results[0].rank).toBe(1);
    expect(results[1].rank).toBe(2);
  });

  it("3. exportService rejects malformed ranking results containing null or invalid entries", async () => {
    // Array with null items
    await expect(
      exportService.exportResults({
        format: "csv",
        rankingResults: [null as unknown as RankingResult],
      })
    ).rejects.toThrow(InvalidExportInputError);

    // Array with undefined items
    await expect(
      exportService.exportResults({
        format: "pdf",
        rankingResults: [undefined as unknown as RankingResult],
      })
    ).rejects.toThrow(InvalidExportInputError);
  });

  it("4. handles minExperienceYears safely (rejects non-finite/strings with HTTP 400, clamps negative values to 0, and preserves defaults when omitted)", async () => {
    const validCandidate: Candidate = {
      id: "cand_test_exp_1",
      documentId: "doc_1",
      fullName: "Jane Doe",
      skills: [{ name: "TypeScript" }],
      experiences: [{ id: "exp_1", role: "Developer", company: "Acme" }],
      education: [],
    };

    // 1. Malformed non-numeric values (strings) must return HTTP 400
    const stringExpReq = new Request("http://localhost:3000/api/screening/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobDescription: {
          rawText: "Looking for a TypeScript developer.",
          minExperienceYears: "three" as unknown as number,
        },
        candidates: [validCandidate],
      }),
    });
    const stringRes = await rankRoutePost(stringExpReq);
    expect(stringRes.status).toBe(400);
    const stringBody = await stringRes.json();
    expect(stringBody.code).toBe("INVALID_EXPERIENCE_REQUIREMENT");

    // 2. Non-finite values (null/NaN) must return HTTP 400
    const nullExpReq = new Request("http://localhost:3000/api/screening/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobDescription: {
          rawText: "Looking for a TypeScript developer.",
          minExperienceYears: null as unknown as number,
        },
        candidates: [validCandidate],
      }),
    });
    const nullRes = await rankRoutePost(nullExpReq);
    expect(nullRes.status).toBe(400);
    const nullBody = await nullRes.json();
    expect(nullBody.code).toBe("INVALID_EXPERIENCE_REQUIREMENT");

    // 3. Negative numeric values must be clamped to 0 without throwing
    const negExpReq = new Request("http://localhost:3000/api/screening/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobDescription: {
          rawText: "Looking for a TypeScript developer.",
          minExperienceYears: -5,
        },
        candidates: [validCandidate],
      }),
    });
    const negRes = await rankRoutePost(negExpReq);
    expect(negRes.status).toBe(200);
    const negBody = await negRes.json();
    expect(negBody.success).toBe(true);
    expect(negBody.jobDescription.experienceRequirement.minimumYears).toBe(0);

    // 4. Omitted minExperienceYears preserves existing default parsing
    const omittedExpReq = new Request("http://localhost:3000/api/screening/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobDescription: {
          rawText: "Requires at least 4 years of experience with TypeScript.",
        },
        candidates: [validCandidate],
      }),
    });
    const omittedRes = await rankRoutePost(omittedExpReq);
    expect(omittedRes.status).toBe(200);
    const omittedBody = await omittedRes.json();
    expect(omittedBody.success).toBe(true);
    expect(omittedBody.jobDescription.experienceRequirement.minimumYears).toBe(4);
  });
});
