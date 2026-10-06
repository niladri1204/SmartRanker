import { describe, it, expect } from "vitest";
import {
  normalizeSkill,
  normalizeSkills,
  resolveSkillAlias,
  compareSkills,
  skillTaxonomyService,
} from "../skill-taxonomy.service";
import { rankingEngineService } from "../ranking-engine.service";
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

describe("Phase 3.4: Skill Synonym & Taxonomy Layer", () => {
  it("1. common aliases normalize to the same canonical skill", () => {
    // React aliases
    const r1 = normalizeSkill("React.js");
    const r2 = normalizeSkill("ReactJS");
    const r3 = normalizeSkill("React");
    expect(r1.canonicalId).toBe("react");
    expect(r2.canonicalId).toBe("react");
    expect(r3.canonicalId).toBe("react");
    expect(r1.canonicalName).toBe("React");
    expect(r1.category).toBe("frontend");

    // Node aliases
    const n1 = normalizeSkill("Node");
    const n2 = normalizeSkill("Node.js");
    const n3 = normalizeSkill("NodeJS");
    expect(n1.canonicalId).toBe("node");
    expect(n2.canonicalId).toBe("node");
    expect(n3.canonicalId).toBe("node");
    expect(n2.canonicalName).toBe("Node.js");
    expect(n2.category).toBe("backend");

    // PostgreSQL aliases
    expect(normalizeSkill("PostgreSQL").canonicalId).toBe("postgresql");
    expect(normalizeSkill("Postgres").canonicalId).toBe("postgresql");
    expect(normalizeSkill("Postgres").canonicalName).toBe("PostgreSQL");

    // Kubernetes aliases
    expect(normalizeSkill("Kubernetes").canonicalId).toBe("kubernetes");
    expect(normalizeSkill("K8s").canonicalId).toBe("kubernetes");

    // C# aliases
    expect(normalizeSkill("C#").canonicalId).toBe("csharp");
    expect(normalizeSkill("C Sharp").canonicalId).toBe("csharp");

    // .NET aliases
    expect(normalizeSkill(".NET").canonicalId).toBe("dotnet");
    expect(normalizeSkill("DotNet").canonicalId).toBe("dotnet");
    expect(normalizeSkill(".NET Core").canonicalId).toBe("dotnet");
    expect(normalizeSkill("ASP.NET Core").canonicalId).toBe("dotnet");

    // Cloud & DevOps aliases
    expect(normalizeSkill("AWS").canonicalId).toBe("aws");
    expect(normalizeSkill("Amazon Web Services").canonicalId).toBe("aws");
    expect(normalizeSkill("GCP").canonicalId).toBe("gcp");
    expect(normalizeSkill("Google Cloud Platform").canonicalId).toBe("gcp");
    expect(normalizeSkill("Azure").canonicalId).toBe("azure");
    expect(normalizeSkill("Microsoft Azure").canonicalId).toBe("azure");
    expect(normalizeSkill("CI/CD").canonicalId).toBe("cicd");
    expect(normalizeSkill("Continuous Integration").canonicalId).toBe("cicd");
    expect(normalizeSkill("REST").canonicalId).toBe("rest");
    expect(normalizeSkill("REST API").canonicalId).toBe("rest");

    // resolveSkillAlias helper
    expect(resolveSkillAlias("React.js")).toBe("React");
    expect(resolveSkillAlias("K8s")).toBe("Kubernetes");
    expect(resolveSkillAlias("Postgres")).toBe("PostgreSQL");
    expect(resolveSkillAlias("NonExistentTech")).toBeNull();
  });

  it("2. unrelated technologies do not incorrectly merge", () => {
    // Frameworks & libraries
    expect(normalizeSkill("React").canonicalId).not.toBe(normalizeSkill("Angular").canonicalId);
    expect(normalizeSkill("Node.js").canonicalId).not.toBe(normalizeSkill("Express").canonicalId);

    // Cloud providers
    expect(normalizeSkill("AWS").canonicalId).not.toBe(normalizeSkill("Azure").canonicalId);
    expect(normalizeSkill("AWS").canonicalId).not.toBe(normalizeSkill("GCP").canonicalId);

    // Databases
    expect(normalizeSkill("SQL").canonicalId).not.toBe(normalizeSkill("PostgreSQL").canonicalId);
    expect(normalizeSkill("MongoDB").canonicalId).not.toBe(normalizeSkill("MySQL").canonicalId);
    expect(normalizeSkill("PostgreSQL").canonicalId).not.toBe(normalizeSkill("MySQL").canonicalId);

    // Programming languages with special symbols
    expect(normalizeSkill("C").canonicalId).not.toBe(normalizeSkill("C++").canonicalId);
    expect(normalizeSkill("C++").canonicalId).not.toBe(normalizeSkill("C#").canonicalId);
    expect(normalizeSkill("C").canonicalId).not.toBe(normalizeSkill("C#").canonicalId);
  });

  it("3. candidate/JD alias matching works correctly", async () => {
    const candidateSkills = ["React.js", "NodeJS", "Postgres"];
    const jobSkills = ["React", "Node.js", "PostgreSQL"];

    // Pure comparison function
    const comparison = compareSkills(candidateSkills, jobSkills);

    expect(comparison.matchScore).toBe(100);
    expect(comparison.matchedJobSkills).toEqual(["React", "Node.js", "PostgreSQL"]);
    expect(comparison.missingJobSkills).toHaveLength(0);
    expect(comparison.matches).toHaveLength(3);

    for (const match of comparison.matches) {
      expect(match.isAliasMatch).toBe(true);
    }

    // End-to-end integration with RankingEngineService
    const job = createJob({
      id: "job_alias_eval",
      title: "Fullstack Engineer",
      requiredSkills: ["React", "Node.js", "PostgreSQL"],
    });

    const candidate = createCandidate({
      id: "cand_alias_eval",
      fullName: "Taylor Stack",
      skills: [{ name: "React.js" }, { name: "NodeJS" }, { name: "Postgres" }],
    });

    const result = await rankingEngineService.evaluateMatch(job, candidate);

    expect(result.matchedRequiredSkills).toEqual(["React", "Node.js", "PostgreSQL"]);
    expect(result.missingRequiredSkills).toHaveLength(0);
    expect(result.scoreBreakdown.requiredSkillScore).toBe(100);

    // Explainability strings must clearly document alias resolution
    expect(result.explanations).toContain("Matched 3/3 required skills (100%).");
    expect(result.explanations).toContain('"React.js" matched "React" via canonical skill "React".');
    expect(result.explanations).toContain('"NodeJS" matched "Node.js" via canonical skill "Node.js".');
    expect(result.explanations).toContain('"Postgres" matched "PostgreSQL" via canonical skill "PostgreSQL".');
  });

  it("4. duplicate aliases collapse while preserving first-seen ordering and explainability", () => {
    const candidateSkills = ["React.js", "React", "NodeJS", "ReactJS", "TypeScript"];

    const normalized = normalizeSkills(candidateSkills);

    // 5 inputs should collapse to 3 canonical skills
    expect(normalized).toHaveLength(3);

    // First-seen ordering preserved
    expect(normalized[0].raw).toBe("React.js");
    expect(normalized[0].canonicalName).toBe("React");

    expect(normalized[1].raw).toBe("NodeJS");
    expect(normalized[1].canonicalName).toBe("Node.js");

    expect(normalized[2].raw).toBe("TypeScript");
    expect(normalized[2].canonicalName).toBe("TypeScript");

    // Match against job requiring React and TypeScript
    const comparison = compareSkills(candidateSkills, ["React", "TypeScript"]);

    expect(comparison.matchScore).toBe(100);
    expect(comparison.matchedJobSkills).toEqual(["React", "TypeScript"]);

    // React match must link to candidate's first-seen alias "React.js"
    const reactMatch = comparison.matches.find((m) => m.canonicalId === "react");
    expect(reactMatch).toBeDefined();
    expect(reactMatch?.candidateSkill).toBe("React.js");
    expect(reactMatch?.jobSkill).toBe("React");
    expect(reactMatch?.isAliasMatch).toBe(true);
  });
});