import { describe, it, expect } from "vitest";
import {
  JobDescriptionProcessorService,
  jobDescriptionProcessorService,
} from "../index";

describe("JobDescriptionProcessorService", () => {
  const service = new JobDescriptionProcessorService();

  it("should expose singleton instance", () => {
    expect(jobDescriptionProcessorService).toBeInstanceOf(
      JobDescriptionProcessorService
    );
  });

  it("should normalize a representative JD conservatively", () => {
    const raw =
      "  Job Title: Senior Backend Engineer  \t\r\n\r\n\r\n\r\n" +
      "Role Overview:   \tBuild scalable microservices.\r" +
      "   Line with trailing spaces.   \n\n\n\n\n" +
      "Required Skills:\n" +
      "- C++, C#, .NET Core, Node.js, and CI/CD pipelines.\n\n\n" +
      "Benefits:   Great culture.   ";

    const result = service.process(raw);

    expect(result.normalizedText).toBe(
      "Job Title: Senior Backend Engineer\n\n" +
        "Role Overview: Build scalable microservices.\n" +
        "Line with trailing spaces.\n\n" +
        "Required Skills:\n" +
        "- C++, C#, .NET Core, Node.js, and CI/CD pipelines.\n\n" +
        "Benefits: Great culture."
    );
    expect(result.characterCount).toBe(result.normalizedText.length);
    expect(result.warnings).toHaveLength(0);
  });

  it("should separate required vs preferred skills accurately", () => {
    const raw = `
Job Title: Full Stack Developer

Role Overview:
We build applications with React and Node.js.

Required Qualifications:
- Strong proficiency in TypeScript, React, Node.js, and PostgreSQL.
- Experience with AWS and CI/CD automation.

Preferred Qualifications:
- Familiarity with Next.js and GraphQL.
- Hands-on experience with Docker and Kubernetes.
`;

    const result = service.process(raw);

    // Required skills should be extracted in first-seen order
    expect(result.requiredSkills).toEqual([
      "TypeScript",
      "React",
      "Node.js",
      "PostgreSQL",
      "AWS",
      "CI/CD",
    ]);

    // Preferred skills must be strictly disjoint from required skills
    expect(result.preferredSkills).toEqual([
      "Next.js",
      "GraphQL",
      "Docker",
      "Kubernetes",
    ]);
  });

  it("should extract explicit experience requirements deterministically", () => {
    // 1. Range pattern
    const rangeJD = `
Required Qualifications:
- 3-5 years of experience in backend development.
- Python and FastAPI.
`;
    const rangeResult = service.process(rangeJD);
    expect(rangeResult.experienceRequirement).toEqual({
      minimumYears: 3,
      maximumYears: 5,
      rawText: "3-5 years of experience",
    });

    // 2. Plus pattern
    const plusJD = `
Requirements:
- 5+ years of software development experience.
- Java and Spring Boot.
`;
    const plusResult = service.process(plusJD);
    expect(plusResult.experienceRequirement).toEqual({
      minimumYears: 5,
      rawText: "5+ years of software development experience",
    });

    // 3. Minimum pattern
    const minJD = `
Requirements:
- At least 2 years of experience with Node.js.
`;
    const minResult = service.process(minJD);
    expect(minResult.experienceRequirement).toEqual({
      minimumYears: 2,
      rawText: "At least 2 years of experience",
    });

    // 4. Seniority title without explicit years should NOT infer years
    const titleOnlyJD = `
Job Title: Senior Lead Staff Architect
Role Overview:
Lead complex software engineering projects.
Requirements:
- Experience designing distributed systems.
`;
    const titleResult = service.process(titleOnlyJD);
    expect(titleResult.experienceRequirement).toBeUndefined();
  });

  it("should extract explicit education and operational requirements", () => {
    const raw = `
Job Title: Cloud Infrastructure Engineer

Required Qualifications:
- Bachelor's degree in Computer Science or related field.
- Must be authorized to work in the United States without sponsorship.
- AWS Certified Solutions Architect certification required.
- Willingness to participate in on-call rotation.

Preferred Qualifications:
- Master's degree preferred.
- Ability to travel up to 20% domestically.
`;

    const result = service.process(raw);

    expect(result.educationRequirements).toEqual([
      "Bachelor's degree in Computer Science or related field",
      "Master's degree preferred",
    ]);

    expect(result.explicitRequirements).toEqual([
      "Must be authorized to work in the United States without sponsorship",
      "AWS Certified Solutions Architect certification required",
      "Willingness to participate in on-call rotation",
      "Ability to travel up to 20% domestically",
    ]);
  });

  it("should handle deduplication, missing sections, and empty text gracefully", () => {
    // Empty text
    const emptyResult = service.process("   \t\r\n   ");
    expect(emptyResult.normalizedText).toBe("");
    expect(emptyResult.characterCount).toBe(0);
    expect(emptyResult.requiredSkills).toEqual([]);
    expect(emptyResult.preferredSkills).toEqual([]);
    expect(emptyResult.warnings).toContain(
      "Job description text is empty or contains only whitespace."
    );

    // Repeated skills in single JD should be deduplicated preserving first-seen order
    const repeatedJD = `
Requirements:
- Must have React, Node.js, and TypeScript.
- Strong knowledge of React architecture and React components.
- Advanced TypeScript and Node.js backend services.
`;
    const dedupResult = service.process(repeatedJD);
    expect(dedupResult.requiredSkills).toEqual(["React", "Node.js", "TypeScript"]);

    // Missing explicit sections should fallback gracefully
    const unsectionedJD = `
We are looking for a developer with experience in Python, Django, and PostgreSQL to join our startup.
`;
    const unsectionedResult = service.process(unsectionedJD);
    expect(unsectionedResult.requiredSkills).toEqual([
      "Python",
      "Django",
      "PostgreSQL",
    ]);
    expect(unsectionedResult.preferredSkills).toEqual([]);
  });
});
