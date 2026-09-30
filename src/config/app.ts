/**
 * SmartRanker global application constants and branding configuration.
 */

export const APP_CONFIG = Object.freeze({
  name: "SmartRanker",
  tagline: "AI-powered resume screening and candidate ranking.",
  shortDescription:
    "Screen, analyze, and rank candidate resumes against job requisitions with precision and transparency.",
  version: "0.1.0-alpha",
  links: {
    github: "https://github.com/niladri1204/SmartRanker",
    documentation: "/docs",
  },
  limits: {
    maxJobDescriptionLength: 15000,
    minJobDescriptionLength: 30,
    defaultMaxResumesPerBatch: 25,
    maxFileSizeMb: 10,
  },
  acceptedFileExtensions: [".pdf", ".docx", ".txt"] as const,
});
