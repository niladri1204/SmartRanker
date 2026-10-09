/**
 * Server-only execution context.
 * Export Orchestration Service.
 * Validates export requests, determines target format, and generates downloadable export packages.
 */
import {
  ExportFormat,
  ExportRankedResultsRequest,
  ExportResult,
  ExportError,
  InvalidExportInputError,
} from "./export.types";
import { csvExporterService } from "./csv-exporter.service";
import { pdfExporterService } from "./pdf-exporter.service";

/**
 * Generates a safe, URL-friendly deterministic filename with timestamp and sanitized job title.
 */
export function generateExportFilename(
  format: ExportFormat,
  jobTitle?: string
): string {
  const sanitizedTitle = (jobTitle || "screening")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "candidates";

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const timeStr = now
    .toISOString()
    .slice(11, 19)
    .replace(/:/g, ""); // HHMMSS

  return `smartranker-${sanitizedTitle}-${dateStr}-${timeStr}.${format}`;
}

export class ExportService {
  /**
   * Orchestrates the export of ranked candidate results into CSV or PDF format.
   */
  public async exportResults(
    request: ExportRankedResultsRequest
  ): Promise<ExportResult> {
    if (!request) {
      throw new InvalidExportInputError("Export request payload is required.");
    }

    const { format, rankingResults, jobTitle } = request;

    if (format !== "csv" && format !== "pdf") {
      throw new InvalidExportInputError(
        `Unsupported export format '${String(format)}'. Supported formats are 'csv' and 'pdf'.`
      );
    }

    if (!Array.isArray(rankingResults) || rankingResults.length === 0) {
      throw new InvalidExportInputError(
        "No candidate ranking results provided for export."
      );
    }

    const filename = generateExportFilename(format, jobTitle);

    try {
      if (format === "csv") {
        return csvExporterService.export(request, filename);
      } else {
        return await pdfExporterService.export(request, filename);
      }
    } catch (err) {
      if (err instanceof ExportError) {
        throw err;
      }
      const message =
        err instanceof Error ? err.message : "Unexpected export error occurred.";
      throw new ExportError(
        `Failed to generate ${format.toUpperCase()} export: ${message}`,
        "EXPORT_GENERATION_FAILED",
        500
      );
    }
  }
}

export const exportService = new ExportService();
