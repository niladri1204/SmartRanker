import { describe, it, expect } from "vitest";
import {
  CandidateExtractorService,
  candidateExtractorService,
} from "../index";

describe("CandidateExtractorService", () => {
  const service = new CandidateExtractorService();

  it("should expose singleton instance", () => {
    expect(candidateExtractorService).toBeInstanceOf(CandidateExtractorService);
  });

  it("should extract candidate name, contact details, and summary from a representative resume", async () => {
    const rawResume = `
Jane Doe
jane.doe@example.com | (555) 123-4567 | San Francisco, CA
https://linkedin.com/in/janedoe | https://github.com/janedoe | https://janedoe.dev

Professional Summary:
Senior Full Stack Engineer with 6+ years of experience designing and scaling cloud native web applications.

Technical Skills:
TypeScript, React, Node.js, AWS
`;

    const candidate = await service.extractCandidate({
      id: "doc_101",
      fileName: "Jane_Doe_Resume.pdf",
      fileSizeBytes: 2048,
      mimeType: "application/pdf",
      uploadedAt: new Date().toISOString(),
      rawText: rawResume,
      status: "parsed",
    });

    expect(candidate.id).toBe("cand_doc_101");
    expect(candidate.documentId).toBe("doc_101");
    expect(candidate.fullName).toBe("Jane Doe");
    expect(candidate.email).toBe("jane.doe@example.com");
    expect(candidate.phone).toBe("5551234567");
    expect(candidate.socialLinks).toEqual({
      linkedin: "https://linkedin.com/in/janedoe",
      github: "https://github.com/janedoe",
      portfolio: "https://janedoe.dev",
    });
    expect(candidate.summary).toContain(
      "Senior Full Stack Engineer with 6+ years of experience"
    );
  });

  it("should extract and deduplicate technical skills without token collisions", () => {
    const rawResume = `
Alex Morgan
alex@example.com

Technical Skills:
- Languages: C++, C#, Python, TypeScript, C
- Frameworks: React.js, React, Node.js, .NET Core, Express.js
- Tools & Cloud: Docker, Kubernetes, AWS, CI/CD, Git
- APIs & Databases: REST APIs, PostgreSQL, MongoDB, Redis
- Repetition: Python, AWS, Docker, React.js
`;

    const candidate = service.extractFromText(rawResume);

    const skillNames = candidate.skills.map((s) => s.name);

    // C++ and C# match without colliding with C
    expect(skillNames).toContain("C++");
    expect(skillNames).toContain("C#");
    expect(skillNames).toContain("C");

    // React.js and React both matched as distinct terms
    expect(skillNames).toContain("React.js");
    expect(skillNames).toContain("React");

    // .NET Core matched without separate .NET collision
    expect(skillNames).toContain(".NET Core");
    expect(skillNames).not.toContain(".NET");

    // REST APIs matched without separate REST API collision
    expect(skillNames).toContain("REST APIs");
    expect(skillNames).not.toContain("REST API");

    // Deduplication check
    const pythonCount = skillNames.filter((s) => s === "Python").length;
    const awsCount = skillNames.filter((s) => s === "AWS").length;
    const dockerCount = skillNames.filter((s) => s === "Docker").length;
    expect(pythonCount).toBe(1);
    expect(awsCount).toBe(1);
    expect(dockerCount).toBe(1);

    // Categories are preserved
    const tsSkill = candidate.skills.find((s) => s.name === "TypeScript");
    expect(tsSkill?.category).toBe("language");
    const dockerSkill = candidate.skills.find((s) => s.name === "Docker");
    expect(dockerSkill?.category).toBe("tool");
  });

  it("should extract basic work-experience entries with role, company, and dates", () => {
    const rawResume = `
Jane Doe
jane.doe@example.com

Work Experience:
Senior Software Engineer | Acme Corporation | Jan 2022 - Mar 2024
- Architected microservices with TypeScript, Node.js, and PostgreSQL.
- Reduced API latency by 35% through Redis caching.

Full Stack Developer at Globex Inc
2020 - Present
- Built customer-facing dashboard with React and Next.js.
- Deployed infrastructure using Docker and AWS.
`;

    const candidate = service.extractFromText(rawResume);

    expect(candidate.experiences).toHaveLength(2);

    const exp1 = candidate.experiences[0];
    expect(exp1.id).toBe("exp-1");
    expect(exp1.role).toBe("Senior Software Engineer");
    expect(exp1.company).toBe("Acme Corporation");
    expect(exp1.startDate).toBe("Jan 2022");
    expect(exp1.endDate).toBe("Mar 2024");
    expect(exp1.isCurrent).toBe(false);
    expect(exp1.highlights).toHaveLength(2);
    expect(exp1.highlights?.[0]).toContain("Architected microservices");

    const exp2 = candidate.experiences[1];
    expect(exp2.id).toBe("exp-2");
    expect(exp2.role).toBe("Full Stack Developer");
    expect(exp2.company).toBe("Globex Inc");
    expect(exp2.startDate).toBe("2020");
    expect(exp2.endDate).toBe("Present");
    expect(exp2.isCurrent).toBe(true);
    expect(exp2.highlights).toHaveLength(2);
  });

  it("should extract basic education entries with degree, institution, and field of study", () => {
    const rawResume = `
Jane Doe
jane.doe@example.com

Education:
Stanford University
Bachelor of Science in Computer Science, 2020

Indian Institute of Technology
B.Tech in Electrical Engineering (2018 - 2022)
`;

    const candidate = service.extractFromText(rawResume);

    expect(candidate.education).toHaveLength(2);

    const edu1 = candidate.education[0];
    expect(edu1.id).toBe("edu-1");
    expect(edu1.institution).toBe("Stanford University");
    expect(edu1.degree).toBe("Bachelor of Science");
    expect(edu1.fieldOfStudy).toBe("Computer Science");
    expect(edu1.graduationYear).toBe(2020);

    const edu2 = candidate.education[1];
    expect(edu2.id).toBe("edu-2");
    expect(edu2.institution).toBe("Indian Institute of Technology");
    expect(edu2.degree).toBe("B.Tech");
    expect(edu2.fieldOfStudy).toBe("Electrical Engineering");
    expect(edu2.graduationYear).toBe(2022);
  });

  it("should handle a sparse/minimal resume gracefully without inventing data", async () => {
    const rawResume = `
Just a brief note with minimal information.
No clear candidate name, no contact details, no dates.
`;

    const candidate = service.extractFromText(rawResume);

    expect(candidate.fullName).toBe("");
    expect(candidate.email).toBeUndefined();
    expect(candidate.phone).toBeUndefined();
    expect(candidate.summary).toBeUndefined();
    expect(candidate.socialLinks).toBeUndefined();
    expect(candidate.skills).toEqual([]);
    expect(candidate.experiences).toEqual([]);
    expect(candidate.education).toEqual([]);
  });
});
