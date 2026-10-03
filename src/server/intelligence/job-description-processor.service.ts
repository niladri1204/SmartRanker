/**
 * Server-only execution context
 * Deterministic Job Description processing and requirement extraction service.
 * Converts raw job description text into structured job requirements.
 */
import {
  IJobDescriptionProcessor,
  JobExperienceRequirement,
  ProcessedJobDescription,
  ProcessJobDescriptionInput,
} from "./job-processor.interface";

/**
 * Curated list of recognizable technical terms and technologies.
 * Preserves exact technical casings and symbols (+, #, ., /, -).
 */
const SKILL_DICTIONARY: readonly string[] = [
  // Languages
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "C++",
  "C#",
  "C",
  "Go",
  "Golang",
  "Rust",
  "Ruby",
  "PHP",
  "Swift",
  "Kotlin",
  "Scala",
  "SQL",
  "HTML",
  "HTML5",
  "CSS",
  "CSS3",

  // Frontend & UI
  "React",
  "React.js",
  "Next.js",
  "Vue",
  "Vue.js",
  "Angular",
  "Svelte",
  "Tailwind",
  "Tailwind CSS",
  "TailwindCSS",
  "Redux",

  // Backend & APIs
  "Node.js",
  "Node",
  "Express",
  "Express.js",
  "NestJS",
  "FastAPI",
  "Django",
  "Flask",
  "Spring Boot",
  "Spring",
  ".NET Core",
  ".NET",
  "ASP.NET",
  "GraphQL",
  "REST APIs",
  "REST API",
  "RESTful APIs",
  "gRPC",

  // Databases & Storage
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "Elasticsearch",
  "SQLite",
  "DynamoDB",
  "Cassandra",
  "pgvector",
  "Pinecone",
  "FAISS",

  // Cloud & DevOps
  "AWS",
  "GCP",
  "Google Cloud",
  "Azure",
  "Docker",
  "Kubernetes",
  "CI/CD",
  "Terraform",
  "Linux",
  "Git",
  "GitHub Actions",

  // Messaging & Architecture
  "Kafka",
  "RabbitMQ",
  "Microservices",
  "Distributed Systems",

  // AI & Data
  "PyTorch",
  "TensorFlow",
  "scikit-learn",
  "Hugging Face",
  "Transformers",
  "NLP",
  "LLMs",
  "RAG",
  "Pandas",
  "NumPy",

  // Testing
  "Jest",
  "Vitest",
  "Playwright",
  "Cypress",
];

/**
 * Section header detection regex patterns.
 */
const REQUIRED_HEADER_REGEX =
  /(?:^|\b)(?:required\s+(?:qualifications?|skills?|requirements?)|must\s+have|mandatory(?:\s+skills?)?|basic\s+qualifications?|minimum\s+qualifications?|what\s+you(?:'ll)?\s+need|requirements)(?:\s*:|\s*$)/i;

const PREFERRED_HEADER_REGEX =
  /(?:^|\b)(?:preferred\s+(?:qualifications?|skills?|requirements?)|nice\s+to\s+have|good\s+to\s+have|bonus(?:\s+points)?|desired\s+(?:qualifications?|skills?)|pluses?|additional\s+qualifications?)(?:\s*:|\s*$)/i;

const OTHER_HEADER_REGEX =
  /(?:^|\b)(?:responsibilities|key\s+responsibilities|role\s+overview|about\s+(?:the\s+role|us)|job\s+summary|benefits|perks|what\s+we\s+offer)(?:\s*:|\s*$)/i;

/**
 * Education pattern that avoids matching the common English word "be".
 */
const EDUCATION_REGEX =
  /(?:\b(?:Bachelor(?:'s)?(?:\s+degree)?|Master(?:'s)?(?:\s+degree)?|PhD|Doctorate|B\.?Tech|M\.?Tech|B\.S\.|M\.S\.|Degree\s+in)\b|\bB\.E\.?(?:\s+|$|\/)|(?<![a-zA-Z])BE(?:\s*\/\s*B\.?Tech|\s+(?:in|degree)\b))/i;

/**
 * Explicit operational constraints pattern (work auth, relocation, certs, clearance, travel).
 */
const EXPLICIT_REQ_REGEX =
  /\b(?:work authorization|authorized to work|visa sponsorship|citizenship|green card|right to work|relocat(?:e|ion)|certified|certification|security clearance|travel up to|willing to travel|on-call rotation)\b/i;

export class JobDescriptionProcessorService implements IJobDescriptionProcessor {
  /**
   * Normalizes raw job description text conservatively:
   * - Converts CRLF/CR to LF
   * - Converts tabs and non-standard Unicode whitespace to single spaces
   * - Collapses excessive horizontal whitespace
   * - Trims per-line leading/trailing whitespace
   * - Collapses excessive vertical blank lines (3+ to 2)
   * - Preserves technical terms, punctuation, and line boundaries
   */
  public normalizeText(rawText: string): string {
    if (!rawText || typeof rawText !== "string") {
      return "";
    }

    // 1. Line endings to LF
    let text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // 2. Tabs to single space
    text = text.replace(/\t/g, " ");

    // 3. Non-standard Unicode whitespace to standard space
    text = text.replace(
      /[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g,
      " "
    );

    // 4. Line-by-line whitespace cleanup
    const lines = text
      .split("\n")
      .map((line) => line.replace(/[^\S\n]+/g, " ").trim());

    // 5. Collapse excessive blank lines and trim document ends
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  /**
   * Categorizes lines into required, preferred, and other section buckets.
   */
  private classifySections(normalizedText: string): {
    requiredLines: string[];
    preferredLines: string[];
    otherLines: string[];
  } {
    const lines = normalizedText.split("\n");
    const requiredLines: string[] = [];
    const preferredLines: string[] = [];
    const otherLines: string[] = [];

    let currentSection: "required" | "preferred" | "other" = "other";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check for section headings
      const cleanHeader = trimmed.replace(/^#+\s*/, "").replace(/:$/, "").trim();
      if (REQUIRED_HEADER_REGEX.test(cleanHeader)) {
        currentSection = "required";
        continue;
      }
      if (PREFERRED_HEADER_REGEX.test(cleanHeader)) {
        currentSection = "preferred";
        continue;
      }
      if (OTHER_HEADER_REGEX.test(cleanHeader)) {
        currentSection = "other";
        continue;
      }

      // Check for inline requirement / preference markers
      if (/\b(?:nice to have|preferred|bonus|plus)\b/i.test(trimmed)) {
        preferredLines.push(trimmed);
      } else if (/\b(?:must have|mandatory|required)\b/i.test(trimmed)) {
        requiredLines.push(trimmed);
      } else if (currentSection === "required") {
        requiredLines.push(trimmed);
      } else if (currentSection === "preferred") {
        preferredLines.push(trimmed);
      } else {
        otherLines.push(trimmed);
      }
    }

    return { requiredLines, preferredLines, otherLines };
  }

  /**
   * Extracts technical skills from a list of lines, preserving first-seen order and casing.
   */
  private extractSkillsFromLines(lines: string[]): string[] {
    if (!lines || lines.length === 0) return [];

    const text = lines.join("\n");
    // Sort terms by length descending to match compound terms before sub-tokens
    const sortedTerms = [...SKILL_DICTIONARY].sort(
      (a, b) => b.length - a.length
    );

    const occupiedRanges: Array<{ start: number; end: number }> = [];
    const matches: Array<{ term: string; index: number }> = [];

    for (const term of sortedTerms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(
        `(?<![a-zA-Z0-9_#+])${escaped}(?![a-zA-Z0-9_#+])`,
        "gi"
      );

      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;

        const overlaps = occupiedRanges.some(
          (r) =>
            (start >= r.start && start < r.end) ||
            (end > r.start && end <= r.end)
        );

        if (!overlaps) {
          occupiedRanges.push({ start, end });
          // Preserve exact matched term casing from the source line when matching
          const sourceMatch = text.slice(start, end);
          matches.push({ term: sourceMatch, index: start });
        }
      }
    }

    // Sort by appearance index to preserve first-seen order
    matches.sort((a, b) => a.index - b.index);

    const result: string[] = [];
    const seen = new Set<string>();

    for (const m of matches) {
      const key = m.term.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(m.term);
      }
    }

    return result;
  }

  /**
   * Extracts explicit experience requirements (years) using deterministic patterns.
   */
  private extractExperienceRequirement(
    text: string
  ): JobExperienceRequirement | undefined {
    // 1. Range pattern: "3-5 years", "3 to 5 years", "3-5 yrs of experience"
    const rangePattern =
      /\b(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\s*(?:\+)?\s*(?:years?|yrs?)(?:\s+of\s+(?:[a-zA-Z\-]+\s+)*experience)?/i;
    const rangeMatch = text.match(rangePattern);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1], 10);
      const max = parseInt(rangeMatch[2], 10);
      if (min <= 30 && max <= 30 && min <= max) {
        return {
          minimumYears: min,
          maximumYears: max,
          rawText: rangeMatch[0].trim(),
        };
      }
    }

    // 2. Minimum pattern: "minimum 3 years", "at least 2 years", "min 5 yrs"
    const minPattern =
      /\b(?:minimum|at least|min\.?)\s+(?:of\s+)?(\d{1,2})\s*(?:\+)?\s*(?:years?|yrs?)(?:\s+of\s+(?:[a-zA-Z\-]+\s+)*experience)?/i;
    const minMatch = text.match(minPattern);
    if (minMatch) {
      const min = parseInt(minMatch[1], 10);
      if (min <= 30) {
        return {
          minimumYears: min,
          rawText: minMatch[0].trim(),
        };
      }
    }

    // 3. Plus pattern: "5+ years", "3+ yrs of experience"
    const plusPattern =
      /\b(\d{1,2})\+\s*(?:years?|yrs?)(?:\s+of\s+(?:[a-zA-Z\-]+\s+)*experience)?/i;
    const plusMatch = text.match(plusPattern);
    if (plusMatch) {
      const min = parseInt(plusMatch[1], 10);
      if (min <= 30) {
        return {
          minimumYears: min,
          rawText: plusMatch[0].trim(),
        };
      }
    }

    // 4. Plain pattern: "2 years of experience"
    const plainPattern =
      /\b(\d{1,2})\s+(?:years?|yrs?)\s+of\s+(?:[a-zA-Z\-]+\s+)*experience/i;
    const plainMatch = text.match(plainPattern);
    if (plainMatch) {
      const min = parseInt(plainMatch[1], 10);
      if (min <= 30) {
        return {
          minimumYears: min,
          rawText: plainMatch[0].trim(),
        };
      }
    }

    return undefined;
  }

  /**
   * Extracts explicit education requirement statements.
   */
  private extractEducationRequirements(lines: string[]): string[] {
    const results: string[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
      if (EDUCATION_REGEX.test(line)) {
        const cleaned = line
          .replace(/^[\s\-*•\d.)]+\s*/, "")
          .replace(/[.;]+$/, "")
          .trim();
        const key = cleaned.toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          results.push(cleaned);
        }
      }
    }

    return results;
  }

  /**
   * Extracts explicit operational requirement statements (work auth, relocation, clearance, certs).
   */
  private extractExplicitRequirements(lines: string[]): string[] {
    const results: string[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
      if (EXPLICIT_REQ_REGEX.test(line)) {
        const cleaned = line
          .replace(/^[\s\-*•\d.)]+\s*/, "")
          .replace(/[.;]+$/, "")
          .trim();
        const key = cleaned.toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          results.push(cleaned);
        }
      }
    }

    return results;
  }

  /**
   * Processes a job description string or input object into a structured profile.
   */
  public process(
    input: ProcessJobDescriptionInput | string
  ): ProcessedJobDescription {
    const raw = typeof input === "string" ? input : input?.rawText ?? "";
    const normalizedText = this.normalizeText(raw);
    const characterCount = normalizedText.length;

    const warnings: string[] = [];

    if (characterCount === 0) {
      warnings.push("Job description text is empty or contains only whitespace.");
      return {
        normalizedText: "",
        characterCount: 0,
        requiredSkills: [],
        preferredSkills: [],
        educationRequirements: [],
        explicitRequirements: [],
        warnings,
      };
    }

    if (characterCount < 50) {
      warnings.push(
        "Job description is unusually short (< 50 characters). Requirements may be incomplete."
      );
    }

    const { requiredLines, preferredLines, otherLines } =
      this.classifySections(normalizedText);

    // Extract skills
    const rawRequiredSkills = this.extractSkillsFromLines(requiredLines);
    const reqKeys = new Set(rawRequiredSkills.map((s) => s.toLowerCase()));

    // Exclude required skills from preferred skills for clean separation
    const preferredSkills = this.extractSkillsFromLines(preferredLines).filter(
      (s) => !reqKeys.has(s.toLowerCase())
    );

    // Fallback: If no required section exists, extract skills from all lines as required
    let finalRequiredSkills = rawRequiredSkills;
    if (finalRequiredSkills.length === 0 && preferredSkills.length === 0) {
      finalRequiredSkills = this.extractSkillsFromLines(otherLines);
    }

    if (finalRequiredSkills.length === 0) {
      warnings.push(
        "No explicit required skills could be identified in the job description."
      );
    }

    // Experience: search required lines first, fallback to entire normalized text
    const experienceRequirement =
      this.extractExperienceRequirement(requiredLines.join("\n")) ||
      this.extractExperienceRequirement(normalizedText);

    // Education & Explicit requirements across all requirement/qualification lines
    const allRelevantLines = [...requiredLines, ...preferredLines, ...otherLines];
    const educationRequirements =
      this.extractEducationRequirements(allRelevantLines);
    const explicitRequirements =
      this.extractExplicitRequirements(allRelevantLines);

    return {
      normalizedText,
      characterCount,
      requiredSkills: finalRequiredSkills,
      preferredSkills,
      experienceRequirement,
      educationRequirements,
      explicitRequirements,
      warnings,
    };
  }
}

export const jobDescriptionProcessorService =
  new JobDescriptionProcessorService();
