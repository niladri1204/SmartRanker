import { describe, it, expect } from "vitest";
import {
  buildJobSemanticText,
  buildCandidateSemanticText,
  buildJobSemanticPayload,
  buildCandidateSemanticPayload,
} from "../semantic-text-builder";
import {
  cosineSimilarity,
  normalizeCosineSimilarity,
  calculateSimilarity,
} from "../cosine-similarity";
import { MockEmbeddingProvider, mockEmbeddingProvider } from "../mock-embedding.provider";
import { rankingEngineService } from "../ranking-engine.service";
import { Candidate, JobDescription } from "@/types";

describe("Phase 3.1: Semantic Matching Foundation", () => {
  it("1. semantic text builder produces deterministic output and preserves technical tokens", () => {
    const job: JobDescription = {
      id: "job_fullstack",
      title: "Senior Backend / Systems Engineer",
      rawText: "Full job spec description...",
      requiredSkills: ["C++", "C#", ".NET", "Node.js", "SQL"],
      preferredSkills: ["Next.js", "Docker", "Kubernetes", "AWS"],
      createdAt: new Date().toISOString(),
    };

    const candidate: Candidate = {
      id: "cand_systems",
      documentId: "doc_1",
      fullName: "Alex Rivera",
      summary: "Experienced software engineer specializing in systems programming and cloud infrastructure.",
      skills: [
        { name: "C++" },
        { name: "C#" },
        { name: ".NET" },
        { name: "Node.js" },
        { name: "Next.js" },
        { name: "Docker" },
      ],
      experiences: [
        {
          id: "exp_1",
          role: "Senior Systems Engineer",
          company: "Tech Systems Inc.",
          highlights: ["Architected microservices in C++ and Node.js", "Maintained CI/CD pipelines"],
        },
      ],
      education: [
        {
          id: "edu_1",
          institution: "State University",
          degree: "B.S.",
          fieldOfStudy: "Computer Science",
        },
      ],
    };

    // 1. Deterministic generation
    const jobText1 = buildJobSemanticText(job);
    const jobText2 = buildJobSemanticText(job);
    expect(jobText1).toBe(jobText2);

    const candText1 = buildCandidateSemanticText(candidate);
    const candText2 = buildCandidateSemanticText(candidate);
    expect(candText1).toBe(candText2);

    // 2. Technical token preservation (C++, C#, .NET, Node.js, Next.js)
    expect(jobText1).toContain("C++");
    expect(jobText1).toContain("C#");
    expect(jobText1).toContain(".NET");
    expect(jobText1).toContain("Node.js");
    expect(jobText1).toContain("Next.js");

    expect(candText1).toContain("C++");
    expect(candText1).toContain("C#");
    expect(candText1).toContain(".NET");
    expect(candText1).toContain("Node.js");
    expect(candText1).toContain("Next.js");

    // 3. Structured payload generation
    const jobPayload = buildJobSemanticPayload(job);
    expect(jobPayload.entityType).toBe("job");
    expect(jobPayload.sections.titleOrRole).toBe("Senior Backend / Systems Engineer");
    expect(jobPayload.sections.skills).toContain("C++");

    const candPayload = buildCandidateSemanticPayload(candidate);
    expect(candPayload.entityType).toBe("candidate");
    expect(candPayload.sections.summary).toBeDefined();
    expect(candPayload.sections.education).toHaveLength(1);
  });

  it("2. provider contract and mock provider return valid typed vectors and batch results", async () => {
    const provider = new MockEmbeddingProvider({ dimensions: 32, modelName: "test-model-v1" });

    expect(provider.providerId).toBe("mock");
    expect(provider.modelName).toBe("test-model-v1");
    expect(provider.dimensions).toBe(32);

    // Single embedding
    const vector = await provider.embed("Software engineer with TypeScript and React experience");
    expect(vector).toHaveLength(32);
    expect(vector.every((val) => Number.isFinite(val))).toBe(true);

    // L2 unit normalization check: sqrt(sum(v_i^2)) should be ~1.0
    const l2Norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    expect(l2Norm).toBeCloseTo(1.0, 3);

    // Deterministic: same input gives identical vector
    const vectorRepeat = await provider.embed("Software engineer with TypeScript and React experience");
    expect(vector).toEqual(vectorRepeat);

    // Batch embedding
    const batch = await provider.embedBatch(["Job title", "Candidate summary", ""]);
    expect(batch).toHaveLength(3);
    expect(batch[0]).toHaveLength(32);
    expect(batch[1]).toHaveLength(32);
    // Empty text yields a zero vector
    expect(batch[2].every((v) => v === 0)).toBe(true);

    // Default singleton provider
    expect(mockEmbeddingProvider.dimensions).toBe(64);
  });

  it("3. cosine similarity handles identical, opposite, orthogonal, and zero vectors safely", () => {
    // Identical unit vectors -> 1
    const vecA = [0.6, 0.8];
    const vecB = [0.6, 0.8];
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0, 5);

    // Opposite vectors -> -1
    const vecOpposite = [-0.6, -0.8];
    expect(cosineSimilarity(vecA, vecOpposite)).toBeCloseTo(-1.0, 5);

    // Orthogonal vectors -> 0
    const vecOrthogonal = [-0.8, 0.6];
    expect(cosineSimilarity(vecA, vecOrthogonal)).toBeCloseTo(0.0, 5);

    // Zero vector -> safely returns 0, never NaN
    const zeroVec = [0, 0];
    expect(cosineSimilarity(zeroVec, vecA)).toBe(0);
    expect(Number.isNaN(cosineSimilarity(zeroVec, vecA))).toBe(false);

    // Empty vectors -> safely returns 0
    expect(cosineSimilarity([], [])).toBe(0);

    // calculateSimilarity utility with normalized score in [0, 1]
    const simResultIdentical = calculateSimilarity(vecA, vecB);
    expect(simResultIdentical.score).toBeCloseTo(1.0, 5);
    expect(simResultIdentical.normalizedScore).toBeCloseTo(1.0, 5);
    expect(simResultIdentical.dimensions).toBe(2);

    const simResultOpposite = calculateSimilarity(vecA, vecOpposite);
    expect(simResultOpposite.score).toBeCloseTo(-1.0, 5);
    expect(simResultOpposite.normalizedScore).toBeCloseTo(0.0, 5);

    // Dimension mismatch throws error
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(/dimension mismatch/i);
  });

  it("4. current deterministic ranking engine continues to work unchanged", async () => {
    const job: JobDescription = {
      id: "job_regression",
      title: "Frontend Engineer",
      rawText: "Frontend role requiring React and TypeScript.",
      requiredSkills: ["React", "TypeScript"],
      minExperienceYears: 2,
      createdAt: new Date().toISOString(),
    };

    const candidate: Candidate = {
      id: "cand_reg_1",
      documentId: "doc_reg",
      fullName: "Taylor Swift Developer",
      skills: [{ name: "React" }, { name: "TypeScript" }],
      totalExperienceYears: 3,
      experiences: [],
      education: [],
    };

    const results = await rankingEngineService.rankCandidates(job, [candidate]);

    expect(results).toHaveLength(1);
    expect(results[0].rank).toBe(1);
    expect(results[0].score).toBe(100);
    expect(results[0].matchedRequiredSkills).toEqual(["React", "TypeScript"]);
    expect(results[0].scoreBreakdown.requiredSkillScore).toBe(100);
    expect(results[0].scoreBreakdown.experienceScore).toBe(100);
  });
});