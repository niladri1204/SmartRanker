import { describe, it, expect } from "vitest";
import {
  ResumeTextPreprocessorService,
  resumeTextPreprocessorService,
} from "../index";

describe("ResumeTextPreprocessorService", () => {
  const service = new ResumeTextPreprocessorService();

  it("should expose singleton instance", () => {
    expect(resumeTextPreprocessorService).toBeInstanceOf(
      ResumeTextPreprocessorService
    );
  });

  it("should normalize whitespace and line endings conservatively", () => {
    const raw =
      "  Jane Doe   \t\tSoftware Engineer  \r\n\r\n\r\n\r\n\r\n" +
      "Summary:   \tExperienced developer.\r" +
      "   Line with trailing space.   \n\n\n\n" +
      "Next section.   ";

    const result = service.preprocess(raw);

    // Line endings must be LF, no tabs, no excessive horizontal or vertical spaces
    expect(result.normalizedText).toBe(
      "Jane Doe Software Engineer\n\n" +
        "Summary: Experienced developer.\n" +
        "Line with trailing space.\n\n" +
        "Next section."
    );
    expect(result.characterCount).toBe(result.normalizedText.length);
  });

  it("should preserve technical tokens, symbols, casings, and punctuation", () => {
    const raw =
      "Skills & Technologies:\n" +
      "- C++, C#, .NET, Node.js, Next.js, and React.js\n" +
      "- Cloud & DevOps: AWS, Docker, Kubernetes, CI/CD pipelines\n" +
      "- Protocols & Databases: REST APIs, GraphQL, TCP/IP, PostgreSQL\n" +
      "- Experience: 5+ years building high-throughput systems.";

    const result = service.preprocess(raw);

    expect(result.normalizedText).toContain("C++");
    expect(result.normalizedText).toContain("C#");
    expect(result.normalizedText).toContain(".NET");
    expect(result.normalizedText).toContain("Node.js");
    expect(result.normalizedText).toContain("Next.js");
    expect(result.normalizedText).toContain("React.js");
    expect(result.normalizedText).toContain("AWS");
    expect(result.normalizedText).toContain("CI/CD");
    expect(result.normalizedText).toContain("TCP/IP");
    expect(result.normalizedText).toContain("5+");
    expect(result.normalizedText).toContain("Skills & Technologies:");
  });

  it("should extract and deduplicate email addresses case-insensitively in first-seen order", () => {
    const raw =
      "Contact Info:\n" +
      "Primary: alex.developer@example.com\n" +
      "Duplicate: ALEX.DEVELOPER@EXAMPLE.COM\n" +
      "Secondary: (alex.dev+work@company.co.in).\n" +
      "Another: info@startup.org;";

    const result = service.preprocess(raw);

    expect(result.emails).toEqual([
      "alex.developer@example.com",
      "alex.dev+work@company.co.in",
      "info@startup.org",
    ]);
  });

  it("should extract phone numbers and URLs while ignoring dates and numbers", () => {
    const raw =
      "Candidate Profile\n" +
      "Mobile: +91 98765-43210, Alt: (555) 234-5678, Direct: 9876543210\n" +
      "Education: 2018 - 2022 (GPA: 3.85 / 4.00, Pin: 560034)\n" +
      "Release: v2.4.1\n" +
      "Links: https://linkedin.com/in/alexchen. and https://github.com/alexchen/project\n" +
      "Portfolio: www.alexchen.dev/portfolio;";

    const result = service.preprocess(raw);

    // Phones: normalized digit-oriented strings, dates/pins/GPAs excluded
    expect(result.phoneNumbers).toEqual([
      "+919876543210",
      "5552345678",
      "9876543210",
    ]);
    expect(result.phoneNumbers).not.toContain("20182022");
    expect(result.phoneNumbers).not.toContain("560034");

    // URLs: trailing punctuation stripped, www. normalized to https://
    expect(result.urls).toEqual([
      "https://linkedin.com/in/alexchen",
      "https://github.com/alexchen/project",
      "https://www.alexchen.dev/portfolio",
    ]);
  });

  it("should handle empty or minimal text gracefully with appropriate warnings", () => {
    // Empty input
    const emptyResult = service.preprocess("");
    expect(emptyResult.normalizedText).toBe("");
    expect(emptyResult.characterCount).toBe(0);
    expect(emptyResult.emails).toEqual([]);
    expect(emptyResult.phoneNumbers).toEqual([]);
    expect(emptyResult.urls).toEqual([]);
    expect(emptyResult.warnings).toContain(
      "Input text is empty or contains only whitespace."
    );

    // Whitespace only input
    const whitespaceResult = service.preprocess("   \t\r\n   \n\n  ");
    expect(whitespaceResult.normalizedText).toBe("");
    expect(whitespaceResult.characterCount).toBe(0);
    expect(whitespaceResult.warnings).toContain(
      "Input text is empty or contains only whitespace."
    );

    // Very short text
    const shortResult = service.preprocess("John Doe");
    expect(shortResult.normalizedText).toBe("John Doe");
    expect(shortResult.characterCount).toBe(8);
    expect(shortResult.warnings.some((w) => w.includes("unusually short"))).toBe(
      true
    );
  });
});
