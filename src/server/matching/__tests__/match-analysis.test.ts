import { describe, it, expect } from "vitest";
import {
  deriveMatchStrength,
  MATCH_STRENGTH_THRESHOLDS,
  matchAnalysisService,
} from "../match-analysis.service";
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

describe("Phase 3.6: Match Gap Analysis & Explainability", () => {
  it("1. required/preferred skill gaps are correctly reported", async () => {
    const job = createJob({
      id: "job_gap_1",
      title: "Senior Fullstack Engineer",
      requiredSkills: ["TypeScript", "React", "Docker"],
      preferredSkills: ["GraphQL", "Kubernetes"],
    });

    const candidate = createCandidate({
      fullName: "Alex Partials",
      skills: [{ name: "TypeScript" }, { name: "GraphQL" }],
    });

    const result = await rankingEngineService.evaluateMatch(job, candidate);

    expect(result.matchAnalysis).toBeDefined();
    const gap = result.matchAnalysis!.skillGap;

    // Required skills summary
    expect(gap.summary.requiredCount).toBe(3);
    expect(gap.summary.requiredMatchedCount).toBe(1);
    expect(gap.summary.requiredMatchRate).toBeCloseTo(0.333, 2);
    expect(gap.summary.missingRequiredSkills).toEqual(["React", "Docker"]);

    // Preferred skills summary
    expect(gap.summary.preferredCount).toBe(2);
    expect(gap.summary.preferredMatchedCount).toBe(1);
    expect(gap.summary.preferredMatchRate).toBe(0.5);
    expect(gap.summary.missingPreferredSkills).toEqual(["Kubernetes"]);

    expect(gap.summary.summaryText).toContain(
      "Required: 1/3 matched; Preferred: 1/2 matched"
    );

    // Attention flag for missing required skills
    expect(result.matchAnalysis!.attentionFlags).toContain(
      "missing-required-skills"
    );
  });

  it("2. alias matches are explained correctly", async () => {
    const job = createJob({
      id: "job_alias_explain",
      title: "Backend Engineer",
      requiredSkills: ["React", "PostgreSQL", "Kubernetes"],
    });

    const candidate = createCandidate({
      fullName: "Taylor Stack",
      skills: [{ name: "React.js" }, { name: "Postgres" }, { name: "K8s" }],
    });

    const result = await rankingEngineService.evaluateMatch(job, candidate);

    expect(result.matchAnalysis).toBeDefined();
    const gap = result.matchAnalysis!.skillGap;

    expect(gap.summary.requiredMatchedCount).toBe(3);
    expect(gap.summary.missingRequiredSkills).toHaveLength(0);

    // All 3 matches should identify as alias matches
    expect(gap.required).toHaveLength(3);
    expect(gap.required.every((s) => s.isMatched && s.isAliasMatch)).toBe(true);

    const reactItem = gap.required.find((s) => s.canonicalId === "react");
    expect(reactItem).toBeDefined();
    expect(reactItem!.candidateSkill).toBe("React.js");
    expect(reactItem!.canonicalName).toBe("React");

    const pgItem = gap.required.find((s) => s.canonicalId === "postgresql");
    expect(pgItem).toBeDefined();
    expect(pgItem!.candidateSkill).toBe("Postgres");
    expect(pgItem!.canonicalName).toBe("PostgreSQL");

    const k8sItem = gap.required.find((s) => s.canonicalId === "kubernetes");
    expect(k8sItem).toBeDefined();
    expect(k8sItem!.candidateSkill).toBe("K8s");
    expect(k8sItem!.canonicalName).toBe("Kubernetes");

    // Detailed bullet points contain clear alias explanations
    const bullets = result.matchAnalysis!.explanation.detailedBulletPoints;
    expect(bullets).toContain(
      '"React.js" matched "React" via canonical skill "React".'
    );
    expect(bullets).toContain(
      '"Postgres" matched "PostgreSQL" via canonical skill "PostgreSQL".'
    );
    expect(bullets).toContain(
      '"K8s" matched "Kubernetes" via canonical skill "Kubernetes".'
    );
  });

  it("3. experience/education/semantic explanations reflect actual ranking results", async () => {
    const job = createJob({
      id: "job_exp_edu",
      title: "Lead Developer",
      rawText: "Qualifications: Bachelor's degree in Computer Science.",
      requiredSkills: ["TypeScript"],
      minExperienceYears: 5,
    });

    const candidate = createCandidate({
      fullName: "Jordan Dev",
      skills: [{ name: "TypeScript" }],
      totalExperienceYears: 3,
      education: [
        {
          id: "edu_1",
          degree: "Bachelor of Science",
          fieldOfStudy: "Computer Science",
          institution: "State University",
        },
      ],
    });

    const result = await rankingEngineService.evaluateMatch(job, candidate);

    expect(result.matchAnalysis).toBeDefined();
    const analysis = result.matchAnalysis!;

    // Experience gap: 3 yrs vs 5 yrs required -> partial
    expect(analysis.experienceGap.requiredYears).toBe(5);
    expect(analysis.experienceGap.candidateYears).toBe(3);
    expect(analysis.experienceGap.status).toBe("partial");
    expect(analysis.experienceGap.explanation).toContain(
      "Candidate has 3 yr(s), below the minimum requirement of 5 yr(s)."
    );

    // Education gap: BS matches -> meets
    expect(analysis.educationGap.status).toBe("meets");
    expect(analysis.educationGap.matchedRequirements.length).toBeGreaterThan(0);

    // Semantic gap: offline/no API key -> failed/unavailable
    expect(["failed", "unavailable"]).toContain(analysis.semanticGap.status);
    expect(analysis.semanticGap.explanation).toBe(
      "Semantic scoring was unavailable; deterministic criteria were used."
    );

    // Attention flags
    expect(analysis.attentionFlags).toContain("experience-below-required");
    expect(analysis.attentionFlags).toContain("semantic-score-unavailable");
  });

  it("4. match-strength labels and attention flags behave correctly at boundary scores", async () => {
    // 1. Boundary score threshold verification
    expect(MATCH_STRENGTH_THRESHOLDS.strong).toBe(80);
    expect(MATCH_STRENGTH_THRESHOLDS.good).toBe(60);
    expect(MATCH_STRENGTH_THRESHOLDS.moderate).toBe(40);

    expect(deriveMatchStrength(100)).toBe("strong");
    expect(deriveMatchStrength(80.0)).toBe("strong");
    expect(deriveMatchStrength(79.9)).toBe("good");
    expect(deriveMatchStrength(60.0)).toBe("good");
    expect(deriveMatchStrength(59.9)).toBe("moderate");
    expect(deriveMatchStrength(40.0)).toBe("moderate");
    expect(deriveMatchStrength(39.9)).toBe("weak");
    expect(deriveMatchStrength(0)).toBe("weak");

    // 2. Strong candidate evaluation
    const job = createJob({
      id: "job_strong",
      requiredSkills: ["TypeScript"],
      minExperienceYears: 2,
    });

    const strongCandidate = createCandidate({
      fullName: "Super Dev",
      skills: [{ name: "TypeScript" }],
      totalExperienceYears: 3,
    });

    const strongResult = await rankingEngineService.evaluateMatch(job, strongCandidate);
    expect(strongResult.matchAnalysis?.strength).toBe("strong");
    expect(strongResult.matchAnalysis?.attentionFlags).not.toContain(
      "missing-required-skills"
    );
    expect(strongResult.matchAnalysis?.attentionFlags).not.toContain(
      "experience-below-required"
    );

    // 3. Incomplete / blank candidate evaluation
    const blankCandidate = createCandidate({
      fullName: "Empty Profile",
      skills: [],
      experiences: [],
    });

    const weakResult = await rankingEngineService.evaluateMatch(job, blankCandidate);
    expect(weakResult.matchAnalysis?.attentionFlags).toContain(
      "missing-required-skills"
    );
    expect(weakResult.matchAnalysis?.attentionFlags).toContain(
      "insufficient-candidate-data"
    );
  });
});