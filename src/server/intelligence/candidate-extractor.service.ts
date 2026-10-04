/**
 * Server-only execution context
 * Deterministic Candidate Profile Extractor Service.
 * Extracts structured candidate profile attributes (name, contacts, skills,
 * experience, education) from preprocessed resume text.
 */
import {
  Candidate,
  CandidateEducation,
  CandidateExperience,
  CandidateSkill,
  JobDescription,
  ResumeDocument,
} from "@/types";
import { ICandidateExtractor } from "./intelligence.interface";
import { ExtractionError } from "@/lib/errors";
import { jobDescriptionProcessorService } from "./job-description-processor.service";
import { resumeTextPreprocessorService } from "./resume-text-preprocessor.service";

/**
 * Internal skill definition entry.
 */
interface SkillDefinition {
  readonly name: string;
  readonly category: CandidateSkill["category"];
}

/**
 * Curated list of technical skills with category classifications.
 * Preserves exact casing and special characters (+, #, ., /, -).
 */
const SKILL_DEFINITIONS: readonly SkillDefinition[] = [
  // Languages
  { name: "JavaScript", category: "language" },
  { name: "TypeScript", category: "language" },
  { name: "Python", category: "language" },
  { name: "Java", category: "language" },
  { name: "C++", category: "language" },
  { name: "C#", category: "language" },
  { name: "C", category: "language" },
  { name: "Go", category: "language" },
  { name: "Golang", category: "language" },
  { name: "Rust", category: "language" },
  { name: "Ruby", category: "language" },
  { name: "PHP", category: "language" },
  { name: "Swift", category: "language" },
  { name: "Kotlin", category: "language" },
  { name: "Scala", category: "language" },
  { name: "SQL", category: "language" },
  { name: "HTML5", category: "language" },
  { name: "HTML", category: "language" },
  { name: "CSS3", category: "language" },
  { name: "CSS", category: "language" },

  // Frameworks & Libraries
  { name: "React.js", category: "framework" },
  { name: "React", category: "framework" },
  { name: "Next.js", category: "framework" },
  { name: "Vue.js", category: "framework" },
  { name: "Vue", category: "framework" },
  { name: "Angular", category: "framework" },
  { name: "Svelte", category: "framework" },
  { name: "Tailwind CSS", category: "framework" },
  { name: "TailwindCSS", category: "framework" },
  { name: "Tailwind", category: "framework" },
  { name: "Redux", category: "framework" },
  { name: "Node.js", category: "framework" },
  { name: "Node", category: "framework" },
  { name: "Express.js", category: "framework" },
  { name: "Express", category: "framework" },
  { name: "NestJS", category: "framework" },
  { name: "FastAPI", category: "framework" },
  { name: "Django", category: "framework" },
  { name: "Flask", category: "framework" },
  { name: "Spring Boot", category: "framework" },
  { name: "Spring", category: "framework" },
  { name: ".NET Core", category: "framework" },
  { name: ".NET", category: "framework" },
  { name: "ASP.NET", category: "framework" },

  // Databases & Storage
  { name: "PostgreSQL", category: "database" },
  { name: "MySQL", category: "database" },
  { name: "MongoDB", category: "database" },
  { name: "Redis", category: "database" },
  { name: "Elasticsearch", category: "database" },
  { name: "SQLite", category: "database" },
  { name: "DynamoDB", category: "database" },
  { name: "Cassandra", category: "database" },
  { name: "pgvector", category: "database" },
  { name: "Pinecone", category: "database" },
  { name: "FAISS", category: "database" },

  // Cloud & Infrastructure
  { name: "AWS", category: "cloud" },
  { name: "GCP", category: "cloud" },
  { name: "Google Cloud", category: "cloud" },
  { name: "Azure", category: "cloud" },

  // Developer Tools & DevOps
  { name: "Docker", category: "tool" },
  { name: "Kubernetes", category: "tool" },
  { name: "CI/CD", category: "tool" },
  { name: "Terraform", category: "tool" },
  { name: "Linux", category: "tool" },
  { name: "Git", category: "tool" },
  { name: "GitHub Actions", category: "tool" },
  { name: "Jest", category: "tool" },
  { name: "Vitest", category: "tool" },
  { name: "Playwright", category: "tool" },
  { name: "Cypress", category: "tool" },

  // Architecture, APIs & AI
  { name: "GraphQL", category: "other" },
  { name: "RESTful APIs", category: "other" },
  { name: "REST APIs", category: "other" },
  { name: "REST API", category: "other" },
  { name: "gRPC", category: "other" },
  { name: "Kafka", category: "other" },
  { name: "RabbitMQ", category: "other" },
  { name: "Microservices", category: "other" },
  { name: "PyTorch", category: "other" },
  { name: "TensorFlow", category: "other" },
  { name: "scikit-learn", category: "other" },
  { name: "Hugging Face", category: "other" },
  { name: "Transformers", category: "other" },
  { name: "Pandas", category: "other" },
  { name: "NumPy", category: "other" },
];

/**
 * Section header detection regex patterns.
 */
const SUMMARY_HEADER_REGEX =
  /(?:^|\b)(?:summary|professional\s+summary|executive\s+summary|about(?:\s+me)?|profile|objective)(?:\s*:|\s*$)/i;

const SKILLS_HEADER_REGEX =
  /(?:^|\b)(?:technical\s+skills|skills(?:\s+(?:&|and)\s+(?:competencies|technologies))?|core\s+competencies|technologies)(?:\s*:|\s*$)/i;

const EXPERIENCE_HEADER_REGEX =
  /(?:^|\b)(?:work\s+experience|professional\s+experience|employment(?:\s+history)?|experience|work\s+history)(?:\s*:|\s*$)/i;

const EDUCATION_HEADER_REGEX =
  /(?:^|\b)(?:education|academic(?:\s+background|\s+qualifications)?|academics)(?:\s*:|\s*$)/i;

const PROJECTS_HEADER_REGEX =
  /(?:^|\b)(?:projects|key\s+projects|academic\s+projects|personal\s+projects)(?:\s*:|\s*$)/i;

const OTHER_HEADER_REGEX =
  /(?:^|\b)(?:certifications?|awards?|honors?|publications?|languages?|interests?|hobbies?|contact(?:\s+information|\s+details)?)(?:\s*:|\s*$)/i;

/**
 * Candidate Name detection regex patterns.
 */
const NAME_LABEL_REGEX =
  /(?:^|\b)(?:name|candidate(?:\s+name)?)\s*:\s*([A-Za-z\u00C0-\u00FF.'-]+(?:\s+[A-Za-z\u00C0-\u00FF.'-]+){1,3})/i;

const JOB_TITLE_REGEX =
  /\b(?:engineer|developer|architect|designer|manager|specialist|consultant|analyst|administrator|intern|scientist|lead|director|officer|programmer|associate|technician|full\s*stack|front\s*end|back\s*end|software|devops|data)\b/i;

const DOC_TITLE_REGEX =
  /^(?:resume|curriculum\s+vitae|cv|profile|portfolio|bio|contact\s+info)$/i;

const STRICT_NAME_REGEX =
  /^[A-Z\u00C0-\u00FF][a-zA-Z\u00C0-\u00FF.'-]*(?:\s+[A-Z\u00C0-\u00FF][a-zA-Z\u00C0-\u00FF.'-]*){1,3}$/;

/**
 * Date range extraction helpers.
 */
const MONTH_NAMES =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

const START_DATE_REGEX_STR = `(?:${MONTH_NAMES}\\.?\\s+(?:19|20)\\d{2}|(?:0?[1-9]|1[0-2])[\\/\\-](?:19|20)\\d{2}|(?:19|20)\\d{2})`;

const END_DATE_REGEX_STR = `(?:${MONTH_NAMES}\\.?\\s+(?:19|20)\\d{2}|(?:0?[1-9]|1[0-2])[\\/\\-](?:19|20)\\d{2}|(?:19|20)\\d{2}|Present|Current|Now)`;

const DATE_RANGE_REGEX = new RegExp(
  `\\b(${START_DATE_REGEX_STR})\\s*(?:-|[\u2013\u2014]|to)\\s*(${END_DATE_REGEX_STR})\\b`,
  "i"
);

/**
 * Education extraction regex patterns.
 * Specifically prevents false positives with English words like "be".
 */
const DEGREE_REGEX =
  /(?:\b(?:Bachelor(?:'s)?(?:\s+degree)?(?:\s+of\s+[A-Za-z]+)?|Master(?:'s)?(?:\s+degree)?(?:\s+of\s+[A-Za-z]+)?|PhD|Doctorate|Ph\.D\.|B\.?Tech\.?|M\.?Tech\.?|B\.?S\.?(?:c\.?)?|M\.?S\.?(?:c\.?)?|B\.?A\.?|M\.?A\.?|MBA)\b|\bB\.E\.?(?:\s+|$|\/|,)|(?<![a-zA-Z])BE(?:\s*\/\s*B\.?Tech|\s+(?:in|degree)\b)|\bM\.E\.?(?:\s+|$|\/|,)|(?<![a-zA-Z])ME(?:\s*\/\s*M\.?Tech|\s+(?:in|degree)\b))/i;

const INSTITUTION_KEYWORD_REGEX =
  /\b(?:University|College|Institute|School|Academy|Polytechnic|Campus|IIT|NIT|BITS|MIT|Stanford|Harvard|Berkeley|Oxford|Cambridge)\b/i;

const FIELD_OF_STUDY_REGEX =
  /\bin\s+([A-Za-z][A-Za-z\s&/-]+?)(?:\s*[,|\u2013\u2014\-|(]|\s+(?:19|20)\d{2}|\s+from\b|$)/i;

const GRADUATION_YEAR_REGEX = /\b(19\d{2}|20\d{2})\b/;

const GPA_REGEX =
  /\b(?:GPA|CGPA)\s*[:=]?\s*(\d(?:\.\d+)?(?:\s*\/\s*\d(?:\.\d+)?)?)\b/i;

/**
 * Classified resume sections.
 */
interface ClassifiedSections {
  headerLines: string[];
  summaryLines: string[];
  skillsLines: string[];
  experienceLines: string[];
  educationLines: string[];
  projectLines: string[];
  otherLines: string[];
}

/**
 * Candidate Profile Extractor Service.
 * Implements deterministic extraction of candidate profile attributes:
 * - Candidate Name
 * - Contact info (Email, Phone, Social Links)
 * - Structured Technical Skills (deduplicated, collision-safe)
 * - Work Experience (chronology, roles, companies, highlights)
 * - Education (degrees, institutions, field of study, graduation year)
 */
export class CandidateExtractorService implements ICandidateExtractor {
  /**
   * Classifies normalized resume text into structured sections using deterministic headings.
   */
  private classifySections(text: string): ClassifiedSections {
    const lines = text.split("\n");
    const sections: ClassifiedSections = {
      headerLines: [],
      summaryLines: [],
      skillsLines: [],
      experienceLines: [],
      educationLines: [],
      projectLines: [],
      otherLines: [],
    };

    let currentSection:
      | "header"
      | "summary"
      | "skills"
      | "experience"
      | "education"
      | "projects"
      | "other" = "header";

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      if (SUMMARY_HEADER_REGEX.test(trimmed)) {
        currentSection = "summary";
        continue;
      }
      if (SKILLS_HEADER_REGEX.test(trimmed)) {
        currentSection = "skills";
        continue;
      }
      if (EXPERIENCE_HEADER_REGEX.test(trimmed)) {
        currentSection = "experience";
        continue;
      }
      if (EDUCATION_HEADER_REGEX.test(trimmed)) {
        currentSection = "education";
        continue;
      }
      if (PROJECTS_HEADER_REGEX.test(trimmed)) {
        currentSection = "projects";
        continue;
      }
      if (OTHER_HEADER_REGEX.test(trimmed)) {
        currentSection = "other";
        continue;
      }

      switch (currentSection) {
        case "header":
          sections.headerLines.push(trimmed);
          break;
        case "summary":
          sections.summaryLines.push(trimmed);
          break;
        case "skills":
          sections.skillsLines.push(trimmed);
          break;
        case "experience":
          sections.experienceLines.push(trimmed);
          break;
        case "education":
          sections.educationLines.push(trimmed);
          break;
        case "projects":
          sections.projectLines.push(trimmed);
          break;
        case "other":
          sections.otherLines.push(trimmed);
          break;
      }
    }

    return sections;
  }

  /**
   * Extracts candidate full name deterministically.
   * Prefers the first clearly name-like line near the beginning of the resume.
   * Does not invent a name or treat contacts, job titles, or headings as names.
   */
  private extractName(headerLines: string[], allLines: string[]): string {
    const linesToCheck = (headerLines.length > 0 ? headerLines : allLines).slice(
      0,
      6
    );

    for (const line of linesToCheck) {
      // 1. Explicit label match: "Name: Jane Doe"
      const labelMatch = line.match(NAME_LABEL_REGEX);
      if (labelMatch) {
        const potentialName = labelMatch[1].trim();
        if (
          STRICT_NAME_REGEX.test(potentialName) &&
          !JOB_TITLE_REGEX.test(potentialName)
        ) {
          return potentialName;
        }
      }

      const cleaned = line.replace(/^[\s\-*\u2022\d.)]+\s*/, "").trim();

      // 2. Reject lines containing contact info or numbers
      if (
        cleaned.includes("@") ||
        cleaned.includes("://") ||
        cleaned.includes("www.") ||
        cleaned.toLowerCase().includes("linkedin") ||
        cleaned.toLowerCase().includes("github") ||
        /\d/.test(cleaned)
      ) {
        continue;
      }

      // 3. Reject document headers or titles
      if (DOC_TITLE_REGEX.test(cleaned)) {
        continue;
      }

      // 4. Direct clean name match (line is exclusively a name)
      if (STRICT_NAME_REGEX.test(cleaned) && !JOB_TITLE_REGEX.test(cleaned)) {
        return cleaned;
      }

      // 5. Name before delimiter (e.g. "Jane Doe | Software Engineer")
      if (/[|\u2013\u2014\-]/.test(cleaned)) {
        const firstPart = cleaned.split(/\s*[|\u2013\u2014\-]\s*/)[0].trim();
        if (
          STRICT_NAME_REGEX.test(firstPart) &&
          !JOB_TITLE_REGEX.test(firstPart)
        ) {
          return firstPart;
        }
      }

      // 6. Name followed by inline job title without delimiter (e.g. "Jane Doe Senior Engineer")
      const words = cleaned.split(/\s+/);
      if (words.length >= 3 && words.length <= 6) {
        for (let i = 2; i <= Math.min(3, words.length - 1); i++) {
          const potentialName = words.slice(0, i).join(" ");
          const remainder = words.slice(i).join(" ");
          if (
            STRICT_NAME_REGEX.test(potentialName) &&
            !JOB_TITLE_REGEX.test(potentialName) &&
            JOB_TITLE_REGEX.test(remainder)
          ) {
            return potentialName;
          }
        }
      }
    }

    return "";
  }

  /**
   * Extracts technical skills using a curated dictionary.
   * Avoids substring collisions (e.g. C vs C++, React vs React.js)
   * and deduplicates case-insensitively while preserving first-seen order.
   */
  private extractSkills(text: string): CandidateSkill[] {
    if (!text) return [];

    // Sort terms by length descending to match composite tokens before substrings
    const sorted = [...SKILL_DEFINITIONS].sort(
      (a, b) => b.name.length - a.name.length
    );

    const occupiedRanges: Array<{ start: number; end: number }> = [];
    const matches: Array<{ skill: CandidateSkill; index: number }> = [];

    for (const def of sorted) {
      const escaped = def.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(
        `(?<![a-zA-Z0-9_#+])${escaped}(?![a-zA-Z0-9_#+])`,
        "gi"
      );

      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;

        // Interval overlap check: start < r.end && end > r.start
        const overlaps = occupiedRanges.some(
          (r) => start < r.end && end > r.start
        );

        if (!overlaps) {
          occupiedRanges.push({ start, end });
          matches.push({
            skill: {
              name: def.name,
              category: def.category,
            },
            index: start,
          });
        }
      }
    }

    // Sort by appearance index to preserve first-seen chronological order
    matches.sort((a, b) => a.index - b.index);

    const result: CandidateSkill[] = [];
    const seen = new Set<string>();

    for (const m of matches) {
      const key = m.skill.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(m.skill);
      }
    }

    return result;
  }

  /**
   * Extracts employment entries with role, company, dates, and highlights.
   */
  private extractExperiences(
    experienceLines: string[],
    allLines: string[]
  ): CandidateExperience[] {
    const lines = experienceLines.length > 0 ? experienceLines : allLines;
    const experiences: CandidateExperience[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const dateMatch = line.match(DATE_RANGE_REGEX);

      if (!dateMatch) {
        continue;
      }

      const startDate = dateMatch[1].trim();
      const endDate = dateMatch[2].trim();
      const isCurrent = /^(?:present|current|now)$/i.test(endDate);

      // Remaining line text excluding the date range and boundary delimiters
      const textWithoutDate = line
        .replace(DATE_RANGE_REGEX, "")
        .replace(/[()]/g, " ")
        .replace(/^\s*[|\u2013\u2014\-[\],;:]+\s*/, "")
        .replace(/\s*[|\u2013\u2014\-[\],;:]+\s*$/, "")
        .trim();

      let role = "";
      let company = "";

      if (textWithoutDate) {
        if (/\s+at\s+/i.test(textWithoutDate)) {
          const atParts = textWithoutDate.split(/\s+at\s+/i);
          role = atParts[0].trim();
          company = atParts[1]?.trim() || "";
        } else if (/[|\u2013\u2014\-]/.test(textWithoutDate)) {
          const parts = textWithoutDate.split(/\s*[|\u2013\u2014\-]\s*/);
          if (parts.length >= 2) {
            if (
              JOB_TITLE_REGEX.test(parts[0]) &&
              !JOB_TITLE_REGEX.test(parts[1])
            ) {
              role = parts[0].trim();
              company = parts[1].trim();
            } else if (
              JOB_TITLE_REGEX.test(parts[1]) &&
              !JOB_TITLE_REGEX.test(parts[0])
            ) {
              role = parts[1].trim();
              company = parts[0].trim();
            } else {
              role = parts[0].trim();
              company = parts[1].trim();
            }
          } else {
            role = parts[0].trim();
          }
        } else if (JOB_TITLE_REGEX.test(textWithoutDate)) {
          role = textWithoutDate;
        } else {
          company = textWithoutDate;
        }
      } else {
        // Line contained only the date range; inspect preceding line(s)
        if (i > 0 && lines[i - 1]) {
          const prev = lines[i - 1].trim();
          if (/\s+at\s+/i.test(prev)) {
            const atParts = prev.split(/\s+at\s+/i);
            role = atParts[0].trim();
            company = atParts[1]?.trim() || "";
          } else if (/[|\u2013\u2014\-]/.test(prev)) {
            const parts = prev.split(/\s*[|\u2013\u2014\-]\s*/);
            if (
              JOB_TITLE_REGEX.test(parts[0]) &&
              !JOB_TITLE_REGEX.test(parts[1])
            ) {
              role = parts[0].trim();
              company = parts[1].trim();
            } else if (
              JOB_TITLE_REGEX.test(parts[1]) &&
              !JOB_TITLE_REGEX.test(parts[0])
            ) {
              role = parts[1].trim();
              company = parts[0].trim();
            } else {
              role = parts[0].trim();
              company = parts[1].trim();
            }
          } else if (JOB_TITLE_REGEX.test(prev)) {
            role = prev;
            if (i > 1 && lines[i - 2] && !DATE_RANGE_REGEX.test(lines[i - 2])) {
              company = lines[i - 2].trim();
            }
          } else {
            company = prev;
            if (i > 1 && lines[i - 2] && JOB_TITLE_REGEX.test(lines[i - 2])) {
              role = lines[i - 2].trim();
            }
          }
        }
      }

      // Collect highlights from following lines until the next date range or section
      const highlights: string[] = [];
      let j = i + 1;
      while (j < lines.length && !DATE_RANGE_REGEX.test(lines[j])) {
        // Stop if the next line is the header for another job whose dates appear immediately after
        if (j < lines.length - 1 && DATE_RANGE_REGEX.test(lines[j + 1])) {
          break;
        }

        const nextLine = lines[j].trim();
        if (
          nextLine &&
          !SUMMARY_HEADER_REGEX.test(nextLine) &&
          !SKILLS_HEADER_REGEX.test(nextLine) &&
          !EDUCATION_HEADER_REGEX.test(nextLine) &&
          !PROJECTS_HEADER_REGEX.test(nextLine)
        ) {
          const cleaned = nextLine.replace(/^[\s\-*\u2022\d.)]+\s*/, "").trim();
          if (cleaned) {
            highlights.push(cleaned);
          }
        } else if (
          SUMMARY_HEADER_REGEX.test(nextLine) ||
          SKILLS_HEADER_REGEX.test(nextLine) ||
          EDUCATION_HEADER_REGEX.test(nextLine) ||
          PROJECTS_HEADER_REGEX.test(nextLine)
        ) {
          break;
        }
        j++;
      }

      experiences.push({
        id: `exp-${experiences.length + 1}`,
        role: role || "Experience",
        company: company || "",
        startDate,
        endDate,
        isCurrent,
        highlights: highlights.length > 0 ? highlights : undefined,
        description: highlights.length > 0 ? highlights.join("\n") : undefined,
      });

      // Advance loop index past processed highlight lines
      i = j - 1;
    }

    return experiences;
  }

  /**
   * Extracts education entries with degrees, institutions, fields of study, and graduation year.
   */
  private extractEducation(
    educationLines: string[],
    allLines: string[]
  ): CandidateEducation[] {
    const lines = educationLines.length > 0 ? educationLines : allLines;
    const educationEntries: CandidateEducation[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const degreeMatch = line.match(DEGREE_REGEX);

      if (!degreeMatch) {
        continue;
      }

      const degree = degreeMatch[0].replace(/[.,]+$/, "").trim();

      // Field of study (e.g. "in Computer Science")
      let fieldOfStudy: string | undefined = undefined;
      const fieldMatch = line.match(FIELD_OF_STUDY_REGEX);
      if (fieldMatch) {
        fieldOfStudy = fieldMatch[1].trim();
      }

      // Graduation year (prefers end year from range, or standalone 4-digit year)
      let graduationYear: number | undefined = undefined;
      const dateRangeMatch = line.match(DATE_RANGE_REGEX);
      if (dateRangeMatch) {
        const endYearMatch = dateRangeMatch[2].match(/\b(19\d{2}|20\d{2})\b/);
        if (endYearMatch) {
          graduationYear = parseInt(endYearMatch[1], 10);
        }
      } else {
        const yearMatch = line.match(GRADUATION_YEAR_REGEX);
        if (yearMatch) {
          graduationYear = parseInt(yearMatch[1], 10);
        }
      }

      // GPA
      let gpa: string | undefined = undefined;
      const gpaMatch = line.match(GPA_REGEX);
      if (gpaMatch) {
        gpa = gpaMatch[1].trim();
      }

      // Institution
      let institution = "";
      const lineWithoutDegree = line
        .replace(DEGREE_REGEX, "")
        .replace(FIELD_OF_STUDY_REGEX, "")
        .replace(GRADUATION_YEAR_REGEX, "")
        .replace(GPA_REGEX, "")
        .replace(/[(),]/g, " ")
        .replace(/^\s*[|\u2013\u2014\-|=;:]+\s*/, "")
        .replace(/\s*[|\u2013\u2014\-|=;:]+\s*$/, "")
        .trim();

      if (INSTITUTION_KEYWORD_REGEX.test(lineWithoutDegree)) {
        institution = lineWithoutDegree.trim();
      } else if (
        i > 0 &&
        lines[i - 1] &&
        (INSTITUTION_KEYWORD_REGEX.test(lines[i - 1]) ||
          !DEGREE_REGEX.test(lines[i - 1]))
      ) {
        institution = lines[i - 1].trim();
      } else if (
        i < lines.length - 1 &&
        lines[i + 1] &&
        INSTITUTION_KEYWORD_REGEX.test(lines[i + 1])
      ) {
        institution = lines[i + 1].trim();
      }

      educationEntries.push({
        id: `edu-${educationEntries.length + 1}`,
        institution,
        degree,
        fieldOfStudy,
        graduationYear,
        gpa,
      });
    }

    return educationEntries;
  }

  /**
   * Extracts summary text from candidate summary section.
   */
  private extractSummary(summaryLines: string[]): string | undefined {
    if (!summaryLines || summaryLines.length === 0) return undefined;
    const text = summaryLines.join(" ").replace(/\s+/g, " ").trim();
    return text.length > 0 ? text : undefined;
  }

  /**
   * Maps extracted contact URLs to social links (LinkedIn, GitHub, Portfolio).
   */
  private extractSocialLinks(
    urls: readonly string[]
  ): Candidate["socialLinks"] | undefined {
    if (!urls || urls.length === 0) return undefined;

    let linkedin: string | undefined;
    let github: string | undefined;
    let portfolio: string | undefined;

    for (const url of urls) {
      const lower = url.toLowerCase();
      if (!linkedin && lower.includes("linkedin.com")) {
        linkedin = url;
      } else if (!github && lower.includes("github.com")) {
        github = url;
      } else if (
        !portfolio &&
        !lower.includes("linkedin.com") &&
        !lower.includes("github.com")
      ) {
        portfolio = url;
      }
    }

    if (linkedin || github || portfolio) {
      return {
        ...(linkedin ? { linkedin } : {}),
        ...(github ? { github } : {}),
        ...(portfolio ? { portfolio } : {}),
      };
    }

    return undefined;
  }

  /**
   * Extracts a structured Candidate entity from raw or preprocessed resume text.
   */
  public extractFromText(
    rawText: string,
    options?: { documentId?: string; fileName?: string }
  ): Candidate {
    const preprocessed = resumeTextPreprocessorService.preprocess(rawText);
    const { normalizedText } = preprocessed;
    const allLines = normalizedText.split("\n");

    const sections = this.classifySections(normalizedText);
    const fullName = this.extractName(sections.headerLines, allLines);
    const skills = this.extractSkills(normalizedText);
    const experiences = this.extractExperiences(
      sections.experienceLines,
      allLines
    );
    const education = this.extractEducation(sections.educationLines, allLines);
    const summary = this.extractSummary(sections.summaryLines);
    const socialLinks = this.extractSocialLinks(preprocessed.urls);

    const documentId = options?.documentId || "doc_default";

    return {
      id: `cand_${documentId}`,
      documentId,
      fullName,
      email: preprocessed.emails.length > 0 ? preprocessed.emails[0] : undefined,
      phone:
        preprocessed.phoneNumbers.length > 0
          ? preprocessed.phoneNumbers[0]
          : undefined,
      summary,
      skills,
      experiences,
      education,
      socialLinks,
    };
  }

  /**
   * Parses and structures unstructured resume text into a rich Candidate profile.
   */
  public async extractCandidate(document: ResumeDocument): Promise<Candidate> {
    if (!document.rawText && document.status !== "parsed") {
      throw new ExtractionError(
        `Cannot extract candidate from unparsed document: ${document.fileName}`
      );
    }

    return this.extractFromText(document.rawText ?? "", {
      documentId: document.id,
      fileName: document.fileName,
    });
  }

  /**
   * Extracts structured requirements and competencies from a raw job description text.
   */
  public async extractJobRequirements(
    jobDescription: JobDescription
  ): Promise<JobDescription> {
    const processed = jobDescriptionProcessorService.process(
      jobDescription.rawText
    );

    return {
      ...jobDescription,
      requiredSkills:
        processed.requiredSkills.length > 0
          ? [...processed.requiredSkills]
          : (jobDescription.requiredSkills ?? []),
      preferredSkills:
        processed.preferredSkills.length > 0
          ? [...processed.preferredSkills]
          : (jobDescription.preferredSkills ?? []),
      minExperienceYears:
        processed.experienceRequirement?.minimumYears ??
        jobDescription.minExperienceYears,
    };
  }
}

export const candidateExtractorService = new CandidateExtractorService();
