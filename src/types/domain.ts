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

export type SemanticAvailability = "available" | "unavailable" | "failed";

export interface SemanticScore {
  readonly rawCosineSimilarity?: number; // raw cosine similarity in [-1, 1]
  readonly normalizedScore?: number; // normalized score in [0, 100]
  readonly similarityScore?: number; // normalized similarity in [0, 1]
  readonly providerId?: string;
  readonly modelName?: string;
  readonly status: SemanticAvailability;
  readonly reason?: string;
}

export type SkillCategory =
  | "frontend"
  | "backend"
  | "database"
  | "cloud"
  | "devops"
  | "programming-language"
  | "framework"
  | "api"
  | "general";

export interface CanonicalSkill {
  readonly id: string;
  readonly name: string;
  readonly category: SkillCategory;
  readonly aliases: readonly string[];
  readonly description?: string;
}

export interface NormalizedSkill {
  readonly raw: string;
  readonly canonicalId: string;
  readonly canonicalName: string;
  readonly category: SkillCategory;
  readonly isKnown: boolean;
  readonly matchedAlias?: string;
}

export interface SkillMatchResult {
  readonly candidateSkill: string;
  readonly jobSkill: string;
  readonly canonicalId: string;
  readonly canonicalName: string;
  readonly isAliasMatch: boolean;
}

export interface SkillComparisonResult {
  readonly matches: readonly SkillMatchResult[];
  readonly matchedJobSkills: readonly string[];
  readonly missingJobSkills: readonly string[];
  readonly matchedCandidateSkills: readonly string[];
  readonly unmatchedCandidateSkills: readonly string[];
  readonly matchRate: number;
  readonly matchScore: number;
}

export interface RankingWeightsInput {
  readonly requiredSkillsWeight?: number;
  readonly semanticSimilarityWeight?: number;
  readonly experienceWeight?: number;
  readonly preferredSkillsWeight?: number;
  readonly educationWeight?: number;
}

export interface RankingWeights {
  readonly requiredSkillsWeight: number;
  readonly semanticSimilarityWeight: number;
  readonly experienceWeight: number;
  readonly preferredSkillsWeight: number;
  readonly educationWeight: number;
}

export type MatchStrength = "strong" | "good" | "moderate" | "weak";

export type AttentionFlag =
  | "missing-required-skills"
  | "experience-below-required"
  | "education-mismatch"
  | "semantic-score-unavailable"
  | "insufficient-candidate-data";

export interface RequirementEvaluation {
  readonly requirementType: "required-skill" | "preferred-skill" | "experience" | "education";
  readonly requirement: string;
  readonly isSatisfied: boolean;
  readonly details: string;
}

export interface SkillGapItem {
  readonly jdSkill: string;
  readonly canonicalId: string;
  readonly canonicalName: string;
  readonly isMatched: boolean;
  readonly candidateSkill?: string;
  readonly isAliasMatch: boolean;
}

export interface SkillGapSummary {
  readonly requiredCount: number;
  readonly requiredMatchedCount: number;
  readonly requiredMatchRate: number;
  readonly preferredCount: number;
  readonly preferredMatchedCount: number;
  readonly preferredMatchRate: number;
  readonly missingRequiredSkills: readonly string[];
  readonly missingPreferredSkills: readonly string[];
  readonly summaryText: string;
}

export interface SkillGap {
  readonly required: readonly SkillGapItem[];
  readonly preferred: readonly SkillGapItem[];
  readonly summary: SkillGapSummary;
}

export interface ExperienceGap {
  readonly requiredYears?: number;
  readonly candidateYears?: number;
  readonly status: "meets" | "partial" | "does-not-meet" | "unavailable";
  readonly explanation: string;
}

export interface EducationGap {
  readonly matchedRequirements: readonly string[];
  readonly unmatchedRequirements: readonly string[];
  readonly status: "meets" | "unmatched" | "unavailable";
  readonly explanation: string;
}

export interface SemanticGap {
  readonly status: SemanticAvailability;
  readonly score?: number;
  readonly similarity?: number;
  readonly explanation: string;
}

export interface MatchExplanation {
  readonly headline: string;
  readonly strongestAreas: readonly string[];
  readonly areasForImprovement: readonly string[];
  readonly detailedBulletPoints: readonly string[];
}

export interface MatchGapAnalysis {
  readonly strength: MatchStrength;
  readonly overallScore: number;
  readonly skillGap: SkillGap;
  readonly experienceGap: ExperienceGap;
  readonly educationGap: EducationGap;
  readonly semanticGap: SemanticGap;
  readonly explanation: MatchExplanation;
  readonly attentionFlags: readonly AttentionFlag[];
  readonly analyzedAt: string;
}

export interface ScoreBreakdown {
  requiredSkillScore: number;
  preferredSkillScore: number;
  experienceScore: number;
  educationScore: number;
  semanticScore?: number; // 0-100 scale when semantic scoring is available
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
  semanticEvaluation?: SemanticScore;
  semanticScore?: number;
  semanticSimilarity?: number;
  semanticProvider?: string;
  semanticModel?: string;
semanticAvailability?: SemanticAvailability;
skillMatches?: readonly SkillMatchResult[];
appliedWeights?: RankingWeights;
  matchAnalysis?: MatchGapAnalysis;
  scoreBreakdown: ScoreBreakdown;
  explanations?: string[];
  summaryNotes?: string;
  warnings?: string[];
  evaluatedAt: string;
}