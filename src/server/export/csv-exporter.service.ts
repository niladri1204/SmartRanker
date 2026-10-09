/**
 * Server-only execution context.
 * Deterministic CSV Exporter for Candidate Ranking Results.
 * Formats ranked candidates into RFC 4180-compliant CSV, including applied weights metadata.
 */
import { RankingResult, RankingWeights } from "@/types";
import { ExportRankedResultsRequest, ExportResult } from "./export.types";

/**
 * Escapes a cell value according to RFC 4180 rules.
 * Wraps values containing commas, double quotes, or newlines in quotes,
 * and doubles internal double quotes.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export class CsvExporterService {
  /**
   * Generates a downloadable CSV string and buffer from ranked candidate results.
   */
  public export(
    request: ExportRankedResultsRequest,
    filename: string
  ): ExportResult {
    const { rankingResults, jobTitle } = request;
    const generatedAt = new Date().toISOString();

    // Derive applied weights from the first result or fallback to default
    const weights: RankingWeights =
      rankingResults.length > 0 && rankingResults[0].appliedWeights
        ? rankingResults[0].appliedWeights
        : {
            requiredSkillsWeight: 40,
            semanticSimilarityWeight: 25,
            experienceWeight: 20,
            preferredSkillsWeight: 10,
            educationWeight: 5,
          };

    const weightsDescription = `Required Skills (${weights.requiredSkillsWeight}%), Semantic Similarity (${weights.semanticSimilarityWeight}%), Experience (${weights.experienceWeight}%), Preferred Skills (${weights.preferredSkillsWeight}%), Education (${weights.educationWeight}%)`;

    const metadataLines: string[] = [
      "# SmartRanker Candidate Ranking Export",
      `# Job Requisition: ${jobTitle || "Requisition"}`,
      `# Generated At: ${generatedAt}`,
      `# Applied Ranking Weights: ${weightsDescription}`,
      `# Total Candidates: ${rankingResults.length}`,
      "#",
    ];

    const columns: string[] = [
      "Rank",
      "Candidate Name",
      "Overall Score",
      "Match Strength",
      "Required Skills Matched",
      "Required Skills Missing",
      "Preferred Skills Matched",
      "Experience Result",
      "Education Result",
      "Semantic Score",
      "Attention Flags",
      "Key Explanation",
    ];

    const headerLine = columns.map(escapeCsvField).join(",");

    const rows = rankingResults.map((res, index) => {
      const rank = res.rank ?? index + 1;
      const candidateName =
        res.candidateName || res.candidate?.fullName || `Candidate ${rank}`;
      const overallScore = `${(res.overallScore ?? res.score).toFixed(1)}%`;
      const matchStrength = res.matchAnalysis?.strength
        ? res.matchAnalysis.strength.toUpperCase()
        : "N/A";

      const matchedReq = (res.matchedRequiredSkills ?? []).join("; ");
      const missingReq = (res.missingRequiredSkills ?? []).join("; ");
      const matchedPref = (res.matchedPreferredSkills ?? []).join("; ");

      const expResult =
        res.experienceEvaluation?.details ||
        (res.experienceEvaluation?.status
          ? `Status: ${res.experienceEvaluation.status}`
          : res.matchAnalysis?.experienceGap.explanation || "N/A");

      const eduResult =
        res.matchedEducationRequirements &&
        res.matchedEducationRequirements.length > 0
          ? res.matchedEducationRequirements.join("; ")
          : res.matchAnalysis?.educationGap.status === "meets"
          ? "Verified"
          : res.matchAnalysis?.educationGap.explanation || "Unmatched";

      const semanticScore =
        typeof res.semanticScore === "number"
          ? `${res.semanticScore.toFixed(1)}%`
          : res.semanticAvailability === "unavailable"
          ? "Unavailable"
          : "N/A";

      const attentionFlags = (
        res.matchAnalysis?.attentionFlags ?? []
      ).join("; ");

      const keyExplanation =
        res.matchAnalysis?.explanation.headline ||
        (res.explanations && res.explanations[0]) ||
        res.summaryNotes ||
        "";

      return [
        escapeCsvField(rank),
        escapeCsvField(candidateName),
        escapeCsvField(overallScore),
        escapeCsvField(matchStrength),
        escapeCsvField(matchedReq),
        escapeCsvField(missingReq),
        escapeCsvField(matchedPref),
        escapeCsvField(expResult),
        escapeCsvField(eduResult),
        escapeCsvField(semanticScore),
        escapeCsvField(attentionFlags),
        escapeCsvField(keyExplanation),
      ].join(",");
    });

    const csvContent = [...metadataLines, headerLine, ...rows].join("\r\n");
    const buffer = Buffer.from(csvContent, "utf8");

    return {
      format: "csv",
      mimeType: "text/csv; charset=utf-8",
      filename,
      data: buffer,
    };
  }
}

export const csvExporterService = new CsvExporterService();
