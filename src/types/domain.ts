/**
 * SmartRanker Core Domain Types
 * Extensible domain entities representing job requisitions, candidate profiles,
 * parsed documents, and ranking evaluations.
 */

/**
 * Supported file formats for resume document ingestion.
 */
export type SupportedDocumentFormat = "pdf" | "docx" | "txt";

/**
 * Shared metadata DTO for ingested resume documents.
 * Encapsulates client-provided file details without exposing filesystem paths.
 */
export interface DocumentMetadataDTO {
  readonly fileName: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly format: SupportedDocumentFormat;
}

export interface CandidateSkill {
  name: string;
  category?:
    | "language"
    | "framework"
    | "database"
    | "tool"
    | "cloud"
    | "soft"
    | "domain"
    | "other";
  yearsOfExperience?: number;
  proficiency?: "beginner" | "intermediate" | "advanced" | "expert";
}

export interface CandidateExperience {
  id: string;
  role: string;
  company: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  description?: string;
  highlights?: string[];
}

export interface CandidateEducation {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  graduationYear?: number;
  gpa?: string;
}

export interface Candidate {
  id: string;
  documentId: string;
  fullName: string;
  email?: string;
  phone?: string;
  location?: string;
  summary?: string;
  skills: CandidateSkill[];
  experiences: CandidateExperience[];
  education: CandidateEducation[];
  totalExperienceYears?: number;
  socialLinks?: {
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
}

export type DocumentProcessingStatus = "pending" | "processing" | "parsed" | "error";

export interface ResumeDocument {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  uploadedAt: string;
  rawText?: string;
  status: DocumentProcessingStatus;
  errorMessage?: string;
}

export interface JobDescription {
  id: string;
  title: string;
  department?: string;
  company?: string;
  location?: string;
  rawText: string;
  requiredSkills?: string[];
  preferredSkills?: string[];
  minExperienceYears?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ExperienceEvaluation {
  requiredYears?: number;
  candidateYears?: number;
  meetsRequirement?: boolean;
  status: "meets" | "below" | "unavailable";
  details: string;
}

export interface ScoreBreakdown {
  requiredSkillScore: number;
  preferredSkillScore: number;
  experienceScore: number;
  educationScore: number;
  skillsMatch?: number;
  experienceMatch?: number;
  semanticRelevance?: number;
}

export interface RankingResult {
  id: string;
  candidateId: string;
  candidateName: string;
  documentId: string;
  candidate?: Candidate;
  score: number; // 0 to 100 overall score
  overallScore?: number; // alias for score
  rank: number;
  matchingSkills: string[];
  missingSkills: string[];
  matchedRequiredSkills: string[];
  missingRequiredSkills: string[];
  matchedPreferredSkills: string[];
  matchedEducationRequirements: string[];
  experienceEvaluation?: ExperienceEvaluation;
  scoreBreakdown: ScoreBreakdown;
  explanations?: string[];
  summaryNotes?: string;
  warnings?: string[];
  evaluatedAt: string;
}