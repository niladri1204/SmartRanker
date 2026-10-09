/**
 * Server-only execution context.
 * Clean, recruiter-oriented PDF Exporter for Candidate Ranking Results.
 * Uses pdf-lib for deterministic, memory-safe PDF generation with multi-page pagination.
 */
import { PDFDocument, StandardFonts, rgb, RGB } from "pdf-lib";
import { RankingResult, RankingWeights } from "@/types";
import { ExportRankedResultsRequest, ExportResult } from "./export.types";

/**
 * Sanitizes input text to guarantee compatibility with WinAnsi standard Helvetica encoding.
 * Filters out unencodable characters and normalizes unicode punctuation.
 */
export function sanitizePdfText(text: unknown): string {
  if (text === null || text === undefined) {
    return "";
  }
  return String(text)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "*")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
    .trim();
}

/**
 * Truncates text with an ellipsis if it exceeds the specified character length.
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

export class PdfExporterService {
  /**
   * Generates a recruiter-readable PDF document from ranked candidate results.
   */
  public async export(
    request: ExportRankedResultsRequest,
    filename: string
  ): Promise<ExportResult> {
    const { rankingResults, jobTitle } = request;
    const doc = await PDFDocument.create();

    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

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

    // Color definitions
    const primaryDark: RGB = rgb(0.08, 0.12, 0.22);
    const textSlate: RGB = rgb(0.20, 0.25, 0.35);
    const textMuted: RGB = rgb(0.45, 0.50, 0.58);
    const borderGray: RGB = rgb(0.85, 0.88, 0.92);
    const cardBg: RGB = rgb(0.97, 0.98, 0.99);
    const accentBlue: RGB = rgb(0.12, 0.38, 0.82);
    const successGreen: RGB = rgb(0.08, 0.55, 0.32);
    const warningAmber: RGB = rgb(0.75, 0.45, 0.08);

    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 40;
    const contentWidth = pageWidth - margin * 2; // 532

    let page = doc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - margin;

    // --- Header Block (Page 1) ---
    page.drawText("SmartRanker - Candidate Ranking Report", {
      x: margin,
      y: currentY,
      size: 16,
      font: fontBold,
      color: primaryDark,
    });
    currentY -= 20;

    const requisitionText = sanitizePdfText(
      `Requisition: ${jobTitle || "Job Requisition"} (${rankingResults.length} Candidate${rankingResults.length === 1 ? "" : "s"})`
    );
    page.drawText(requisitionText, {
      x: margin,
      y: currentY,
      size: 11,
      font: fontRegular,
      color: accentBlue,
    });
    currentY -= 15;

    const timestampText = sanitizePdfText(
      `Generated: ${new Date().toUTCString()}`
    );
    page.drawText(timestampText, {
      x: margin,
      y: currentY,
      size: 8.5,
      font: fontRegular,
      color: textMuted,
    });
    currentY -= 18;

    // Applied Weights pill bar
    const weightsText = sanitizePdfText(
      `Applied Weights: Skills ${weights.requiredSkillsWeight}% | Semantic ${weights.semanticSimilarityWeight}% | Experience ${weights.experienceWeight}% | Preferred ${weights.preferredSkillsWeight}% | Education ${weights.educationWeight}%`
    );
    page.drawRectangle({
      x: margin,
      y: currentY - 6,
      width: contentWidth,
      height: 20,
      color: rgb(0.92, 0.95, 0.99),
      borderColor: rgb(0.75, 0.85, 0.95),
      borderWidth: 0.5,
    });
    page.drawText(weightsText, {
      x: margin + 8,
      y: currentY,
      size: 8,
      font: fontBold,
      color: primaryDark,
    });
    currentY -= 25;

    // Divider line
    page.drawLine({
      start: { x: margin, y: currentY },
      end: { x: pageWidth - margin, y: currentY },
      thickness: 1,
      color: borderGray,
    });
    currentY -= 18;

    // --- Candidate Entries ---
    const cardHeight = 94;

    for (let i = 0; i < rankingResults.length; i++) {
      const res = rankingResults[i];
      const rank = res.rank ?? i + 1;

      // Check if page has enough room for candidate card
      if (currentY - cardHeight < 60) {
        page = doc.addPage([pageWidth, pageHeight]);
        currentY = pageHeight - margin;

        // Running header on continuation pages
        page.drawText("SmartRanker - Candidate Ranking Report (Continued)", {
          x: margin,
          y: currentY,
          size: 10,
          font: fontBold,
          color: textMuted,
        });
        currentY -= 12;
        page.drawLine({
          start: { x: margin, y: currentY },
          end: { x: pageWidth - margin, y: currentY },
          thickness: 0.5,
          color: borderGray,
        });
        currentY -= 18;
      }

      // Draw Card Container
      page.drawRectangle({
        x: margin,
        y: currentY - cardHeight,
        width: contentWidth,
        height: cardHeight,
        color: cardBg,
        borderColor: borderGray,
        borderWidth: 1,
      });

      // Line 1: Rank, Name, Score, Strength
      const candName = sanitizePdfText(
        res.candidateName || res.candidate?.fullName || `Candidate ${rank}`
      );
      const scoreStr = `${(res.overallScore ?? res.score).toFixed(1)}%`;
      const strength = (res.matchAnalysis?.strength || "MODERATE").toUpperCase();

      page.drawText(`#${rank}  ${truncate(candName, 32)}`, {
        x: margin + 10,
        y: currentY - 18,
        size: 11,
        font: fontBold,
        color: primaryDark,
      });

      page.drawText(`Score: ${scoreStr}`, {
        x: margin + 340,
        y: currentY - 18,
        size: 11,
        font: fontBold,
        color: accentBlue,
      });

      const strengthColor =
        strength === "STRONG"
          ? successGreen
          : strength === "GOOD"
          ? accentBlue
          : strength === "MODERATE"
          ? warningAmber
          : textMuted;

      page.drawText(`[${strength}]`, {
        x: margin + 450,
        y: currentY - 18,
        size: 9,
        font: fontBold,
        color: strengthColor,
      });

      // Line 2: Headline Summary
      const headline = sanitizePdfText(
        res.matchAnalysis?.explanation.headline ||
          (res.explanations && res.explanations[0]) ||
          res.summaryNotes ||
          "Candidate evaluated against job profile criteria."
      );
      page.drawText(truncate(headline, 90), {
        x: margin + 10,
        y: currentY - 34,
        size: 8.5,
        font: fontOblique,
        color: textSlate,
      });

      // Line 3: Required Skills Matched / Missing
      const matchedReq = sanitizePdfText(
        (res.matchedRequiredSkills ?? []).join(", ") || "None"
      );
      const missingReq = sanitizePdfText(
        (res.missingRequiredSkills ?? []).join(", ") || "None"
      );

      page.drawText(
        `Req. Skills Matched: ${truncate(matchedReq, 40)}`,
        {
          x: margin + 10,
          y: currentY - 49,
          size: 8,
          font: fontRegular,
          color: textSlate,
        }
      );

      page.drawText(
        `Missing: ${truncate(missingReq, 35)}`,
        {
          x: margin + 280,
          y: currentY - 49,
          size: 8,
          font: fontRegular,
          color: missingReq === "None" ? successGreen : rgb(0.75, 0.15, 0.15),
        }
      );

      // Line 4: Experience, Education, Semantic
      const expStatus = sanitizePdfText(
        res.experienceEvaluation?.status === "meets"
          ? `Meets (${res.experienceEvaluation.candidateYears ?? 0} yrs)`
          : res.experienceEvaluation?.status ||
            res.matchAnalysis?.experienceGap.status ||
            "N/A"
      );

      const eduStatus = sanitizePdfText(
        res.matchedEducationRequirements &&
          res.matchedEducationRequirements.length > 0
          ? truncate(res.matchedEducationRequirements[0], 20)
          : res.matchAnalysis?.educationGap.status === "meets"
          ? "Verified"
          : "Unmatched"
      );

      const semScore =
        typeof res.semanticScore === "number"
          ? `${res.semanticScore.toFixed(1)}%`
          : res.semanticAvailability === "unavailable"
          ? "Unavailable"
          : "N/A";

      page.drawText(
        `Experience: ${expStatus}  |  Education: ${eduStatus}  |  Semantic: ${semScore}`,
        {
          x: margin + 10,
          y: currentY - 64,
          size: 8,
          font: fontRegular,
          color: textSlate,
        }
      );

      // Line 5: Attention Flags or Preferred Skills
      const flags = res.matchAnalysis?.attentionFlags ?? [];
      if (flags.length > 0) {
        const flagText = sanitizePdfText(
          `Attention Flags: ${flags.join(", ")}`
        );
        page.drawText(truncate(flagText, 85), {
          x: margin + 10,
          y: currentY - 79,
          size: 7.5,
          font: fontBold,
          color: warningAmber,
        });
      } else {
        const prefMatched = sanitizePdfText(
          (res.matchedPreferredSkills ?? []).join(", ") || "None specified"
        );
        page.drawText(
          `Preferred Skills: ${truncate(prefMatched, 80)}`,
          {
            x: margin + 10,
            y: currentY - 79,
            size: 7.5,
            font: fontRegular,
            color: textMuted,
          }
        );
      }

      currentY -= cardHeight + 10;
    }

    // --- Footer on all pages ---
    const pages = doc.getPages();
    const totalPages = pages.length;
    for (let p = 0; p < totalPages; p++) {
      const curPage = pages[p];
      curPage.drawLine({
        start: { x: margin, y: 35 },
        end: { x: pageWidth - margin, y: 35 },
        thickness: 0.5,
        color: borderGray,
      });

      const footerText = sanitizePdfText(
        `SmartRanker Confidential Recruitment Report  *  Page ${p + 1} of ${totalPages}`
      );
      curPage.drawText(footerText, {
        x: margin,
        y: 22,
        size: 7.5,
        font: fontRegular,
        color: textMuted,
      });
    }

    const pdfBytes = await doc.save();
    const buffer = Buffer.from(pdfBytes);

    return {
      format: "pdf",
      mimeType: "application/pdf",
      filename,
      data: buffer,
    };
  }
}

export const pdfExporterService = new PdfExporterService();
