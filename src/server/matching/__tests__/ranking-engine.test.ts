import { describe, it, expect } from "vitest";
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

describe("Phase 2.10: Deterministic Matching & Ranking Engine", () => {
  it("1. calculates required and preferred skill scoring with case-insensitive exact matching", async () => {
    const job = createJob({
      id: "job_1",
      title: "Senior Fullstack Engineer",
      rawText: "We need an engineer.",
      requiredSkills: ["TypeScript", "React", "Node.js"],
      preferredSkills: ["Docker", "GraphQL"],
    });

    const candidate = createCandidate({
      fullName: "Alex Rivera",
      skills: [
        { name: "typescript" }, // case-insensitive match
        { name: "React" },
        { name: "docker" },
        { name: "Python" }, // unrequested skill
      ],
    });

    const result = await rankingEngineService.evaluateMatch(job, candidate);

    // Required skills: TypeScript, React matched (2 / 3 = 66.7%)
    expect(result.matchedRequiredSkills).toEqual(["TypeScript", "React"]);
    expect(result.missingRequiredSkills).toEqual(["Node.js"]);
    expect(result.scoreBreakdown.requiredSkillScore).toBe(66.7);

    // Preferred skills: Docker matched (1 / 2 = 50%)
    expect(result.matchedPreferredSkills).toEqual(["Docker"]);
    expect(result.scoreBreakdown.preferredSkillScore).toBe(50);

    // Weight redistribution: only Required (40) and Preferred (10) are active (total 50)
    // overall = (66.7 * (40/50)) + (50 * (10/50)) = 53.36 + 10.0 = 63.36 -> 63.4
    expect(result.score).toBe(63.4);
    expect(result.overallScore).toBe(63.4);
    expect(result.explanations).toContain("Matched 2/3 required skills (67%).");
    expect(result.explanations).toContain("Missing required skill: Node.js");
  });

  it("2. derives experience safely from non-overlapping employment date ranges", async () => {
    const job = createJob({
      id: "job_exp",
      title: "Software Engineer",
      rawText: "Requires 3 years of experience.",
      minExperienceYears: 3,
      requiredSkills: [],
    });

    // Candidate with 3 roles, with Role 2 overlapping entirely inside Role 1:
    // Role 1: Jan 2020 - Dec 2021 (24 months = 2.0 yrs)
    // Role 2: Jul 2020 - Jun 2021 (fully overlaps Role 1)
    // Role 3: Jan 2022 - Dec 2022 (12 months = 1.0 yr)
    // Merged non-overlapping experience = 3.0 yrs (not 4.0 yrs!)
    const candidateOverlapping = createCandidate({
      fullName: "Jordan Lee",
      experiences: [
        {
          id: "exp_1",
          role: "Developer",
          company: "Company A",
          startDate: "Jan 2020",
          endDate: "Dec 2021",
        },
        {
          id: "exp_2",
          role: "Consultant",
          company: "Company B",
          startDate: "Jul 2020",
          endDate: "Jun 2021",
        },
        {
          id: "exp_3",
          role: "Senior Developer",
          company: "Company C",
          startDate: "Jan 2022",
          endDate: "Dec 2022",
        },
      ],
    });

    const result = await rankingEngineService.evaluateMatch(job, candidateOverlapping);

    expect(result.experienceEvaluation?.candidateYears).toBe(3);
    expect(result.experienceEvaluation?.meetsRequirement).toBe(true);
    expect(result.scoreBreakdown.experienceScore).toBe(100);

    // Compare with candidate who only has 1.5 years experience:
    const candidateJunior = createCandidate({
      fullName: "Junior Dev",
      experiences: [
        {
          id: "exp_j",
          role: "Junior Dev",
          company: "Company J",
          startDate: "Jan 2021",
          endDate: "Jun 2022", // 18 months = 1.5 yrs
        },
      ],
    });

    const resultJunior = await rankingEngineService.evaluateMatch(job, candidateJunior);
    expect(resultJunior.experienceEvaluation?.candidateYears).toBe(1.5);
    expect(resultJunior.experienceEvaluation?.meetsRequirement).toBe(false);
    expect(resultJunior.scoreBreakdown.experienceScore).toBe(50); // 1.5 / 3 = 50%
  });

  it("3. verifies explicit education requirements conservatively", async () => {
    const jobWithEducation = createJob({
      id: "job_edu",
      title: "Data Scientist",
      rawText: "Qualifications: Bachelor's degree in Computer Science or related field.",
    });

    const candidateWithBS = createCandidate({
      fullName: "Degree Holder",
      education: [
        {
          id: "edu_1",
          institution: "University of Tech",
          degree: "B.S. in Computer Science",
        },
      ],
    });

    const candidateWithoutDegree = createCandidate({
      fullName: "Self Taught",
      education: [
        {
          id: "edu_2",
          institution: "High School",
          degree: "High School Diploma",
        },
      ],
    });

    const resultMatched = await rankingEngineService.evaluateMatch(jobWithEducation, candidateWithBS);
    expect(resultMatched.scoreBreakdown.educationScore).toBe(100);
    expect(resultMatched.matchedEducationRequirements.length).toBeGreaterThan(0);

    const resultUnmatched = await rankingEngineService.evaluateMatch(jobWithEducation, candidateWithoutDegree);
    expect(resultUnmatched.scoreBreakdown.educationScore).toBe(0);
    expect(resultUnmatched.matchedEducationRequirements).toHaveLength(0);
  });

  it("4. ranks candidates and resolves ties deterministically using multi-tier criteria", async () => {
    const job = createJob({
      id: "job_rank",
      title: "Backend Engineer",
      rawText: "Backend position requiring Python and SQL.",
      requiredSkills: ["Python", "SQL"],
      minExperienceYears: 4,
    });

    // Candidate A: 100% skills, 4 yrs exp (100% exp) -> Overall score 100
    const candA = createCandidate({
      id: "cand_a",
      fullName: "Candidate A",
      skills: [{ name: "Python" }, { name: "SQL" }],
      totalExperienceYears: 4,
    });

    // Candidate B: 50% skills, 4 yrs exp (100% exp) -> Overall score: (50*50 + 100*25)/75 = 66.7
    // Named "Bob"
    const candB = createCandidate({
      id: "cand_b",
      fullName: "Bob",
      skills: [{ name: "Python" }],
      totalExperienceYears: 4,
    });

    // Candidate C: 100% skills, 0 yrs exp (0% exp) -> Overall score: (100*50 + 0*25)/75 = 66.7
    // Same overall score as B, but higher required-skill score (100% vs 50%) -> should beat B!
    const candC = createCandidate({
      id: "cand_c",
      fullName: "Charlie",
      skills: [{ name: "Python" }, { name: "SQL" }],
      totalExperienceYears: 0,
    });

    // Candidate D: 50% skills, 4 yrs exp (100% exp) -> Overall score 66.7
    // Identical scores to B (50% skill, 100% exp), but named "Alice" -> should beat "Bob" by alphabetical tie-breaker!
    const candD = createCandidate({
      id: "cand_d",
      fullName: "Alice",
      skills: [{ name: "Python" }],
      totalExperienceYears: 4,
    });

    const ranked = await rankingEngineService.rankCandidates(job, [candB, candA, candC, candD]);

    expect(ranked).toHaveLength(4);

    // 1st: Candidate A (Score 100)
    expect(ranked[0].candidateName).toBe("Candidate A");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].score).toBe(100);

    // 2nd: Charlie (Score 66.7, Tie-break tier 1: higher required skills 100% vs 50%)
    expect(ranked[1].candidateName).toBe("Charlie");
    expect(ranked[1].rank).toBe(2);
    expect(ranked[1].scoreBreakdown.requiredSkillScore).toBe(100);

    // 3rd: Alice (Score 66.7, same scores as Bob, Tie-break tier 3: "Alice" before "Bob")
    expect(ranked[2].candidateName).toBe("Alice");
    expect(ranked[2].rank).toBe(3);

    // 4th: Bob (Score 66.7)
    expect(ranked[3].candidateName).toBe("Bob");
    expect(ranked[3].rank).toBe(4);
  });

  it("5. handles empty inputs, missing profiles, and unparseable dates safely without exceptions", async () => {
    const job = createJob({
      id: "job_empty",
      title: "General Role",
      rawText: "",
      requiredSkills: [],
    });

    // 1. Zero candidates returns empty array
    const emptyResult = await rankingEngineService.rankCandidates(job, []);
    expect(emptyResult).toEqual([]);

    // 2. Candidate with no skills, no experiences, no education against empty JD
    const blankCandidate = createCandidate({
      fullName: "Blank Profile",
      skills: [],
      experiences: [],
      education: [],
    });

    const evaluatedBlank = await rankingEngineService.evaluateMatch(job, blankCandidate);
    expect(evaluatedBlank.score).toBeGreaterThanOrEqual(0);
    expect(evaluatedBlank.score).toBeLessThanOrEqual(100);
    expect(isNaN(evaluatedBlank.score)).toBe(false);

    // 3. Candidate with unparseable experience dates when JD requires experience
    const jobRequiringExp = createJob({
      id: "job_req_exp",
      title: "Developer",
      rawText: "Must have 5 years experience.",
      minExperienceYears: 5,
      requiredSkills: ["Git"],
    });

    const candidateUnparseableDates = createCandidate({
      fullName: "Vague Dates",
      skills: [{ name: "Git" }],
      experiences: [
        {
          id: "exp_vague",
          role: "Software Dev",
          company: "Unknown",
          startDate: "Some time ago",
          endDate: "Recently",
        },
      ],
    });

    const resultVague = await rankingEngineService.evaluateMatch(jobRequiringExp, candidateUnparseableDates);
    // Experience dimension should be marked unavailable and weight redistributed to Required Skills
    expect(resultVague.experienceEvaluation?.status).toBe("unavailable");
    expect(resultVague.warnings).toContain(
      "Experience dimension excluded from scoring due to unparseable employment dates."
    );
    // Required skills was 1/1 (100%), so redistributed overall score is 100
    expect(resultVague.score).toBe(100);
  });
});