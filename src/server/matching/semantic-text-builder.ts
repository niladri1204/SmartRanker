/**
 * Server-only execution context.
 * Deterministic semantic text preparation for Job Descriptions and Candidate profiles.
 * Formats high-signal profile components while preserving exact technical tokens
 * (e.g. C++, C#, .NET, Node.js, Next.js, CI/CD).
 */
import {
  Candidate,
  CandidateSkill,
} from "@/types";
import { MatchJobInput } from "./matching.interface";
import { SemanticTextPayload } from "./semantic.interface";

/**
 * Normalizes multi-line whitespace while preserving internal token punctuation.
 */
function cleanLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Builds deterministic semantic text for a Job Description or ProcessedJobDescription.
 */
export function buildJobSemanticText(job: MatchJobInput): string {
  const payload = buildJobSemanticPayload(job);
  return payload.fullText;
}

/**
 * Builds a structured SemanticTextPayload for a Job Description.
 */
export function buildJobSemanticPayload(job: MatchJobInput): SemanticTextPayload {
  const entityId = "id" in job && job.id ? job.id : "job";
  const title = "title" in job && typeof job.title === "string" ? cleanLine(job.title) : "";

  // Required skills (preserving exact token casing and symbols)
  const rawRequiredSkills = Array.isArray(job.requiredSkills) ? job.requiredSkills : [];
  const requiredSkills = rawRequiredSkills
    .map((s) => cleanLine(String(s)))
    .filter(Boolean);

  // Preferred skills
  const rawPreferredSkills = Array.isArray(job.preferredSkills) ? job.preferredSkills : [];
  const preferredSkills = rawPreferredSkills
    .map((s) => cleanLine(String(s)))
    .filter(Boolean);

  // Education requirements
  const rawEducationReqs =
    "educationRequirements" in job && Array.isArray(job.educationRequirements)
      ? job.educationRequirements
      : [];
  const educationReqs = rawEducationReqs
    .map((e) => cleanLine(String(e)))
    .filter(Boolean);

  // Explicit requirements
  const rawExplicitReqs =
    "explicitRequirements" in job && Array.isArray(job.explicitRequirements)
      ? job.explicitRequirements
      : [];
  const explicitReqs = rawExplicitReqs
    .map((r) => cleanLine(String(r)))
    .filter(Boolean);

  const sectionsList: string[] = [];

  if (title) {
    sectionsList.push(`Role: ${title}`);
  }

  if (requiredSkills.length > 0) {
    sectionsList.push(`Required Skills: ${requiredSkills.join(", ")}`);
  }

  if (preferredSkills.length > 0) {
    sectionsList.push(`Preferred Skills: ${preferredSkills.join(", ")}`);
  }

  if (educationReqs.length > 0) {
    sectionsList.push(`Education: ${educationReqs.join("; ")}`);
  }

  if (explicitReqs.length > 0) {
    sectionsList.push(`Requirements: ${explicitReqs.join("; ")}`);
  }

  const fullText = sectionsList.join("\n");

  return {
    entityId,
    entityType: "job",
    fullText,
    sections: {
      titleOrRole: title || undefined,
      skills: [...requiredSkills, ...preferredSkills],
      experienceOrRequirements: explicitReqs,
      education: educationReqs,
    },
  };
}

/**
 * Builds deterministic semantic text for a Candidate profile.
 */
export function buildCandidateSemanticText(candidate: Candidate): string {
  const payload = buildCandidateSemanticPayload(candidate);
  return payload.fullText;
}

/**
 * Builds a structured SemanticTextPayload for a Candidate profile.
 */
export function buildCandidateSemanticPayload(candidate: Candidate): SemanticTextPayload {
  const entityId = candidate.id || "candidate";

  // Summary
  const summary = candidate.summary ? cleanLine(candidate.summary) : "";

  // Skills: preserve exact skill names (e.g. C++, C#, .NET, Node.js)
  const skills = (candidate.skills ?? [])
    .map((s: CandidateSkill) => cleanLine(s.name || ""))
    .filter(Boolean);

  // Experience: format roles and highlights cleanly
  const experienceSections: string[] = [];
  for (const exp of candidate.experiences ?? []) {
    const role = cleanLine(exp.role || "");
    const company = cleanLine(exp.company || "");
    let expLine = role;
    if (company) {
      expLine = expLine ? `${expLine} at ${company}` : company;
    }

    if (Array.isArray(exp.highlights) && exp.highlights.length > 0) {
      const topHighlights = exp.highlights
        .slice(0, 3)
        .map((h) => cleanLine(h))
        .filter(Boolean);
      if (topHighlights.length > 0) {
        expLine += `: ${topHighlights.join("; ")}`;
      }
    } else if (exp.description) {
      const descSnippet = cleanLine(exp.description).slice(0, 150);
      if (descSnippet) {
        expLine += `: ${descSnippet}`;
      }
    }

    if (expLine) {
      experienceSections.push(expLine);
    }
  }

  // Education: degree, field, institution
  const educationSections: string[] = [];
  for (const edu of candidate.education ?? []) {
    const degree = cleanLine(edu.degree || "");
    const field = cleanLine(edu.fieldOfStudy || "");
    const inst = cleanLine(edu.institution || "");

    let eduLine = degree;
    if (field) {
      eduLine = eduLine ? `${eduLine} in ${field}` : field;
    }
    if (inst) {
      eduLine = eduLine ? `${eduLine}, ${inst}` : inst;
    }

    if (eduLine) {
      educationSections.push(eduLine);
    }
  }

  const sectionsList: string[] = [];

  if (summary) {
    sectionsList.push(`Summary: ${summary}`);
  }

  if (skills.length > 0) {
    sectionsList.push(`Skills: ${skills.join(", ")}`);
  }

  if (experienceSections.length > 0) {
    sectionsList.push(`Experience:\n- ${experienceSections.join("\n- ")}`);
  }

  if (educationSections.length > 0) {
    sectionsList.push(`Education:\n- ${educationSections.join("\n- ")}`);
  }

  const fullText = sectionsList.join("\n");

  return {
    entityId,
    entityType: "candidate",
    fullText,
    sections: {
      summary: summary || undefined,
      skills,
      experienceOrRequirements: experienceSections,
      education: educationSections,
    },
  };
}

export class SemanticTextBuilderService {
  public buildJobText(job: MatchJobInput): string {
    return buildJobSemanticText(job);
  }

  public buildJobPayload(job: MatchJobInput): SemanticTextPayload {
    return buildJobSemanticPayload(job);
  }

  public buildCandidateText(candidate: Candidate): string {
    return buildCandidateSemanticText(candidate);
  }

  public buildCandidatePayload(candidate: Candidate): SemanticTextPayload {
    return buildCandidateSemanticPayload(candidate);
  }
}

export const semanticTextBuilderService = new SemanticTextBuilderService();