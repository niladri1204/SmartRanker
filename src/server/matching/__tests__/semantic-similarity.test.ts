import { describe, it, expect } from "vitest";
import { RankingEngineService } from "../ranking-engine.service";
import { MockEmbeddingProvider, mockEmbeddingProvider } from "../mock-embedding.provider";
import { IEmbeddingProvider, EmbeddingVector } from "../semantic.interface";
import { Candidate, JobDescription } from "@/types";

function createCandidate(partial: Partial<Candidate> = {}): Candidate {
  return {
    id: partial.id ?? `cand_${Math.random().toString(36).substring(2, 7)}`,
    documentId: partial.documentId ?? "doc_1",
    fullName: partial.fullName ?? "Jane Doe",
    skills: partial.skills ?? [],
    experiences: partial.experiences ?? [],
    education: partial.education ?? [],
    ...partial,
  };
}

function createJob(partial: Partial<JobDescription> = {}): JobDescription {
  return {
    id: partial.id ?? "job_1",
    title: partial.title ?? "Software Engineer",
    rawText: partial.rawText ?? "",
    createdAt: partial.createdAt ?? new Date().toISOString(),
    ...partial,
  };
}

describe("Phase 3.3: Semantic Similarity Integration", () => {
  it("1. candidate/job embeddings produce a valid semantic similarity score", async () => {
    const job = createJob({
      id: "job_frontend",
      title: "Senior Frontend Engineer",
      rawText: "Looking for a Senior Frontend Engineer proficient in React, TypeScript, and modern frontend architecture.",
      requiredSkills: ["React", "TypeScript"],
      preferredSkills: ["Next.js"],
    });

    const candidate = createCandidate({
      id: "cand_react_lead",
      fullName: "Alex Rivera",
      summary: "Senior Frontend Engineer with deep expertise in React, TypeScript, Next.js, and web performance.",
      skills: [{ name: "React" }, { name: "TypeScript" }, { name: "Next.js" }],
    });

    const mockProvider = new MockEmbeddingProvider({ dimensions: 64 });
    const engine = new RankingEngineService({ embeddingProvider: mockProvider });

    const result = await engine.evaluateMatch(job, candidate);

    expect(result.semanticAvailability).toBe("available");
    expect(result.semanticScore).toBeDefined();
    expect(typeof result.semanticScore).toBe("number");
    expect(result.semanticScore).toBeGreaterThanOrEqual(0);
    expect(result.semanticScore).toBeLessThanOrEqual(100);

    expect(result.semanticSimilarity).toBeDefined();
    expect(typeof result.semanticSimilarity).toBe("number");
    expect(result.semanticSimilarity).toBeGreaterThanOrEqual(-1);
    expect(result.semanticSimilarity).toBeLessThanOrEqual(1);

    expect(result.semanticProvider).toBe("mock");
    expect(result.semanticModel).toBe("mock-embedding-v1");

    expect(result.semanticEvaluation).toBeDefined();
    expect(result.semanticEvaluation?.status).toBe("available");
    expect(result.semanticEvaluation?.providerId).toBe("mock");
    expect(result.semanticEvaluation?.modelName).toBe("mock-embedding-v1");
    expect(result.semanticEvaluation?.normalizedScore).toBe(result.semanticScore);
    expect(result.semanticEvaluation?.rawCosineSimilarity).toBe(result.semanticSimilarity);

    expect(result.scoreBreakdown.semanticScore).toBe(result.semanticScore);
    expect(result.scoreBreakdown.semanticRelevance).toBe(result.semanticScore);
    expect(result.explanations).toContain(`Semantic similarity: ${result.semanticScore}%.`);
  });

  it("2. hybrid scoring combines deterministic and semantic dimensions using the specified weights", async () => {
    // Custom provider producing a known vector pair:
    // Job vector: [1, 0]
    // Candidate vector: [0.6, 0.8]
    // Raw cosine similarity: 1*0.6 + 0*0.8 = 0.6
    // Normalized score in [0, 1]: (0.6 + 1) / 2 = 0.8
    // Normalized score in [0, 100]: 80.0
    class ControlledEmbeddingProvider implements IEmbeddingProvider {
      public readonly providerId = "controlled";
      public readonly modelName = "controlled-v1";
      public readonly dimensions = 2;

      public async embed(text: string): Promise<EmbeddingVector> {
        if (text.includes("Job") || text.includes("Role")) {
          return [1, 0];
        }
        return [0.6, 0.8];
      }

      public async embedBatch(texts: readonly string[]): Promise<readonly EmbeddingVector[]> {
        return Promise.all(texts.map((t) => this.embed(t)));
      }
    }

    const job = createJob({
      id: "job_full",
      title: "Fullstack Developer",
      rawText: "Qualifications: Bachelor's degree in Computer Science or related field.",
      requiredSkills: ["TypeScript", "React"], // 2 skills
      preferredSkills: ["GraphQL"], // 1 skill
      minExperienceYears: 5,
    });

    const candidate = createCandidate({
      id: "cand_hybrid",
      fullName: "Dev Specialist",
      skills: [{ name: "TypeScript" }, { name: "GraphQL" }], // Required: 1/2 (50%), Preferred: 1/1 (100%)
      totalExperienceYears: 5, // Meets: 100%
      education: [
        {
          id: "edu_1",
          degree: "Bachelor of Science",
          fieldOfStudy: "Computer Science",
          institution: "MIT",
        },
      ], // Meets: 100%
      summary: "Fullstack Developer with strong background.",
    });

    const controlledProvider = new ControlledEmbeddingProvider();
    const engine = new RankingEngineService({ embeddingProvider: controlledProvider });

    const result = await engine.evaluateMatch(job, candidate);

    // Baseline dimension scores:
    // - Required skills: 50.0% (weight 40%) -> 50.0 * 0.40 = 20.0
    // - Semantic similarity: 80.0% (weight 25%) -> 80.0 * 0.25 = 20.0
    // - Experience: 100.0% (weight 20%) -> 100.0 * 0.20 = 20.0
    // - Preferred skills: 100.0% (weight 10%) -> 100.0 * 0.10 = 10.0
    // - Education: 100.0% (weight 5%) -> 100.0 * 0.05 = 5.0
    // Total weight = 100, Sum = 20 + 20 + 20 + 10 + 5 = 75.0
    expect(result.scoreBreakdown.requiredSkillScore).toBe(50);
    expect(result.semanticScore).toBe(80);
    expect(result.scoreBreakdown.experienceScore).toBe(100);
    expect(result.scoreBreakdown.preferredSkillScore).toBe(100);
    expect(result.scoreBreakdown.educationScore).toBe(100);
    expect(result.overallScore).toBe(75);
    expect(result.score).toBe(75);

    // Verify proportional weight redistribution when a dimension is omitted:
    // Job without education requirement (Education dimension inactive):
    const jobNoEdu = createJob({
      id: "job_no_edu",
      title: "Fullstack Developer",
      rawText: "Fullstack role with no degree requirement.",
      requiredSkills: ["TypeScript", "React"],
      preferredSkills: ["GraphQL"],
      minExperienceYears: 5,
    });

    const resultNoEdu = await engine.evaluateMatch(jobNoEdu, candidate);
    // Active weights: Required (40), Semantic (25), Experience (20), Preferred (10) -> Total = 95
    // Sum = (50*40 + 80*25 + 100*20 + 100*10) / 95 = (2000 + 2000 + 2000 + 1000) / 95 = 7000 / 95 = 73.684... -> 73.7
    expect(resultNoEdu.overallScore).toBe(73.7);
    expect(resultNoEdu.score).toBe(73.7);
  });

  it("3. multiple candidates use batch embedding while preserving candidate association/order", async () => {
    let embedJobCalls = 0;
    let embedBatchCalls = 0;
    let batchInputTexts: readonly string[] = [];

    const trackingProvider: IEmbeddingProvider = {
      providerId: "mock-tracking",
      modelName: "mock-tracking-v1",
      dimensions: 64,
      async embed(text: string) {
        embedJobCalls++;
        return mockEmbeddingProvider.embed(text);
      },
      async embedBatch(texts: readonly string[]) {
        embedBatchCalls++;
        batchInputTexts = texts;
        return mockEmbeddingProvider.embedBatch(texts);
      },
    };

    const job = createJob({
      id: "job_batch",
      title: "Cloud Architect",
      rawText: "Cloud Architect role focusing on AWS, Terraform, and Kubernetes infrastructure.",
      requiredSkills: ["AWS", "Kubernetes"],
    });

    const candA = createCandidate({
      id: "cand_a",
      fullName: "Alice AWS",
      summary: "Specialized in AWS cloud architecture.",
      skills: [{ name: "AWS" }, { name: "Kubernetes" }],
    });

    const candB = createCandidate({
      id: "cand_b",
      fullName: "Bob Kubernetes",
      summary: "Kubernetes specialist.",
      skills: [{ name: "Kubernetes" }],
    });

    const candC = createCandidate({
      id: "cand_c",
      fullName: "Charlie Python",
      summary: "Python developer with no cloud skills.",
      skills: [{ name: "Python" }],
    });

    const engine = new RankingEngineService({ embeddingProvider: trackingProvider });

    const results = await engine.rankCandidates(job, [candA, candB, candC]);

    // Efficiency verification:
    // 1. Job text is embedded exactly ONCE
    expect(embedJobCalls).toBe(1);
    // 2. Candidate texts are batch-embedded in ONE call
    expect(embedBatchCalls).toBe(1);
    expect(batchInputTexts).toHaveLength(3);

    // 3. Batch input ordering preserves original candidate array sequence
    expect(batchInputTexts[0]).toContain("AWS cloud architecture");
    expect(batchInputTexts[1]).toContain("Kubernetes specialist");
    expect(batchInputTexts[2]).toContain("Python developer with no cloud skills");

    // 4. Results ordering and ranks
    expect(results).toHaveLength(3);
    expect(results[0].rank).toBe(1);
    expect(results[1].rank).toBe(2);
    expect(results[2].rank).toBe(3);

    // 5. Each candidate maintains its distinct semantic metadata
    for (const r of results) {
      expect(r.semanticAvailability).toBe("available");
      expect(r.semanticProvider).toBe("mock-tracking");
      expect(typeof r.semanticScore).toBe("number");
    }

    // Alice matches 2/2 required skills, Bob 1/2, Charlie 0/2 -> Alice should rank #1
    expect(results[0].candidateId).toBe("cand_a");
  });

  it("4. semantic provider failure gracefully falls back to deterministic ranking", async () => {
    const failingProvider: IEmbeddingProvider = {
      providerId: "failing-provider",
      modelName: "fail-model",
      dimensions: 64,
      async embed() {
        throw new Error("OpenAI API rate limit exceeded (429)");
      },
      async embedBatch() {
        throw new Error("OpenAI API rate limit exceeded (429)");
      },
    };

    const job = createJob({
      id: "job_fallback",
      title: "Backend Engineer",
      rawText: "Requires Node.js and PostgreSQL, 3 years experience.",
      requiredSkills: ["Node.js", "PostgreSQL"],
      minExperienceYears: 3,
    });

    const candidate = createCandidate({
      id: "cand_fallback",
      fullName: "Resilient Candidate",
      skills: [{ name: "Node.js" }, { name: "PostgreSQL" }],
      totalExperienceYears: 4,
    });

    const engine = new RankingEngineService({ embeddingProvider: failingProvider });

    // Operation must not crash
    const results = await engine.rankCandidates(job, [candidate]);

    expect(results).toHaveLength(1);
    const r = results[0];

    // Semantic status should be recorded as failed without fabricated score
    expect(r.semanticAvailability).toBe("failed");
    expect(r.semanticScore).toBeUndefined();
    expect(r.semanticSimilarity).toBeUndefined();
    expect(r.semanticEvaluation?.status).toBe("failed");
    expect(r.semanticEvaluation?.reason).toContain("OpenAI API rate limit exceeded (429)");

    // Warnings and explanations should report deterministic fallback
    expect(r.warnings).toContain("Semantic scoring unavailable; deterministic criteria used.");
    expect(r.explanations).toContain("Semantic scoring unavailable; deterministic criteria used.");

    // Deterministic evaluation must proceed with weight redistribution
    // Active dimensions: Required Skills (40) and Experience (20) -> Total = 60
    // Candidate matches 2/2 required skills (100%) and 4/3 yrs exp (100%)
    // Score: (100 * 40 + 100 * 20) / 60 = 100.0
    expect(r.scoreBreakdown.requiredSkillScore).toBe(100);
    expect(r.scoreBreakdown.experienceScore).toBe(100);
    expect(r.score).toBe(100);
    expect(r.overallScore).toBe(100);
  });
});