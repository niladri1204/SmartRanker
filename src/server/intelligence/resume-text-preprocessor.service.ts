/**
 * Server-only execution context
 * Deterministic resume text preprocessor and normalization service.
 * Performs non-destructive text cleaning and lightweight contact extraction.
 */
import {
  IResumeTextPreprocessor,
  PreprocessedResumeOutput,
  PreprocessTextInput,
} from "./text-preprocessor.interface";

/**
 * Standard regular expressions for lightweight, deterministic contact extraction.
 */
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/**
 * Captures URLs with http/https or www. prefixes, excluding trailing punctuation.
 */
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"'{}|\\^`]+[^\s<>"'{}|\\^`.,;:)]/g;

/**
 * Captures international and national phone numbers:
 * - Optional +CC or 00CC prefix
 * - Optional area codes in parentheses or separated
 * - Digit groups separated by spaces, dots, or hyphens
 * - Between 10 and 15 total digits
 */
const PHONE_PATTERN =
  /(?:(?:\+|00)[1-9]\d{0,2}[\s.-]*)?(?:\(?\d{2,5}\)?[\s.-]*)?\d{3,5}[\s.-]*\d{3,5}\b/g;

export class ResumeTextPreprocessorService implements IResumeTextPreprocessor {
  /**
   * Normalizes raw extracted text using conservative, non-destructive rules:
   * - Converts CRLF and CR to LF
   * - Converts tabs and non-standard whitespace to standard spaces
   * - Collapses excessive horizontal whitespace per line
   * - Trims per-line leading/trailing whitespace
   * - Collapses excessive vertical blank lines (3+ to 2)
   * - Preserves technical terms, casings, punctuation, and line boundaries
   */
  public normalizeText(rawText: string): string {
    if (!rawText || typeof rawText !== "string") {
      return "";
    }

    // 1. Normalize line endings to LF
    let text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // 2. Normalize horizontal tabs to spaces
    text = text.replace(/\t/g, " ");

    // 3. Normalize non-standard Unicode whitespace (NBSP, zero-width space, etc.)
    text = text.replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, " ");

    // 4. Line-by-line: collapse excessive horizontal whitespace and trim line boundaries
    const lines = text
      .split("\n")
      .map((line) => line.replace(/[^\S\n]+/g, " ").trim());

    // 5. Rejoin and collapse excessive blank lines (3 or more consecutive newlines -> 2)
    const rejoined = lines.join("\n").replace(/\n{3,}/g, "\n\n");

    // 6. Trim document leading and trailing whitespace
    return rejoined.trim();
  }

  /**
   * Extracts and deduplicates email addresses while preserving first-seen order.
   */
  public extractEmails(text: string): string[] {
    if (!text) return [];

    const emails: string[] = [];
    const seen = new Set<string>();

    for (const match of text.matchAll(EMAIL_REGEX)) {
      const raw = match[0].replace(/[.,;:)]+$/, "").trim();
      const normalized = raw.toLowerCase();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        emails.push(normalized);
      }
    }

    return emails;
  }

  /**
   * Extracts and deduplicates HTTP/HTTPS and www URLs while preserving first-seen order.
   */
  public extractUrls(text: string): string[] {
    if (!text) return [];

    const urls: string[] = [];
    const seen = new Set<string>();

    for (const match of text.matchAll(URL_REGEX)) {
      let raw = match[0].replace(/[.,;:)]+$/, "").trim();
      if (raw.startsWith("www.")) {
        raw = `https://${raw}`;
      }
      if (raw && !seen.has(raw)) {
        seen.add(raw);
        urls.push(raw);
      }
    }

    return urls;
  }

  /**
   * Extracts and deduplicates valid phone numbers with digit-oriented normalization.
   * Excludes dates, years, and short numeric identifiers.
   */
  public extractPhoneNumbers(text: string): string[] {
    if (!text) return [];

    const phoneNumbers: string[] = [];
    const seen = new Set<string>();

    for (const match of text.matchAll(PHONE_PATTERN)) {
      const raw = match[0].trim();
      const digits = raw.replace(/\D/g, "");

      // Standard international phone numbers require 10 to 15 digits
      if (digits.length < 10 || digits.length > 15) {
        continue;
      }

      // Preserve '+' prefix if explicitly present in original source; otherwise pure digits
      const normalized = raw.startsWith("+") ? `+${digits}` : digits;

      if (!seen.has(normalized)) {
        seen.add(normalized);
        phoneNumbers.push(normalized);
      }
    }

    return phoneNumbers;
  }

  /**
   * Executes conservative text normalization and lightweight contact extraction.
   */
  public preprocess(input: PreprocessTextInput | string): PreprocessedResumeOutput {
    const raw = typeof input === "string" ? input : input?.rawText ?? "";
    const normalizedText = this.normalizeText(raw);
    const characterCount = normalizedText.length;

    const warnings: string[] = [];

    if (characterCount === 0) {
      warnings.push("Input text is empty or contains only whitespace.");
      return {
        normalizedText: "",
        characterCount: 0,
        emails: [],
        phoneNumbers: [],
        urls: [],
        warnings,
      };
    }

    if (characterCount < 50) {
      warnings.push(
        "Extracted text is unusually short (< 50 characters). Document may be incomplete or image-based."
      );
    }

    const emails = this.extractEmails(normalizedText);
    const phoneNumbers = this.extractPhoneNumbers(normalizedText);
    const urls = this.extractUrls(normalizedText);

    return {
      normalizedText,
      characterCount,
      emails,
      phoneNumbers,
      urls,
      warnings,
    };
  }
}

export const resumeTextPreprocessorService = new ResumeTextPreprocessorService();
