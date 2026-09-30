/**
 * SmartRanker Core Domain Types
 * Extensible domain entities representing job requisitions, candidate profiles,
 * parsed documents, and ranking evaluations.
 */

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

export interface ScoreBreakdown {
  skillsMatch: number;
  experienceMatch: number;
  semanticRelevance: number;
}

export interface RankingResult {
  id: string;
  candidateId: string;
  candidateName: string;
  documentId: string;
  score: number; // 0 to 1 scale or 0 to 100
  rank: number;
  matchingSkills: string[];
  missingSkills: string[];
  scoreBreakdown?: ScoreBreakdown;
  summaryNotes?: string;
  evaluatedAt: string;
}
