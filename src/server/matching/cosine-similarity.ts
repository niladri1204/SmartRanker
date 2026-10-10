/**
 * Server-only execution context.
 * Mathematical vector operations and robust cosine similarity calculations.
 */
import { EmbeddingVector, SimilarityResult } from "./semantic.interface";

/**
 * Computes raw cosine similarity between two numeric vectors in [-1, 1].
 *
 * Rules:
 * - Returns 0 for empty vectors (length 0).
 * - Returns 0 if either vector has zero magnitude (zero vector).
 * - Clamps result strictly within [-1, 1].
 * - Never returns NaN or Infinity.
 * - Throws an Error if vectors have mismatched lengths.
 */
export function cosineSimilarity(
  vecA: EmbeddingVector,
  vecB: EmbeddingVector
): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) {
    return 0;
  }

  if (vecA.length !== vecB.length) {
    throw new Error(
      `Cosine similarity dimension mismatch: vector A has length ${vecA.length}, but vector B has length ${vecB.length}.`
    );
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const valA = Number.isFinite(vecA[i]) ? vecA[i] : 0;
    const valB = Number.isFinite(vecB[i]) ? vecB[i] : 0;

    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA <= 0 || normB <= 0) {
    return 0;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator <= 0 || !Number.isFinite(denominator)) {
    return 0;
  }

  const raw = dotProduct / denominator;
  if (!Number.isFinite(raw)) {
    return 0;
  }

  // Clamp strictly between -1 and 1
  return Math.max(-1, Math.min(1, raw));
}

/**
 * Normalizes a raw cosine similarity score from [-1, 1] to [0, 1].
 * Useful for percentage-based scoring metrics.
 */
export function normalizeCosineSimilarity(rawScore: number): number {
  if (!Number.isFinite(rawScore)) {
    return 0;
  }
  const clamped = Math.max(-1, Math.min(1, rawScore));
  return (clamped + 1) / 2;
}

/**
 * Computes cosine similarity and returns a typed SimilarityResult.
 */
export function calculateSimilarity(
  vecA: EmbeddingVector,
  vecB: EmbeddingVector
): SimilarityResult {
  const score = cosineSimilarity(vecA, vecB);
  const normalizedScore = normalizeCosineSimilarity(score);
  const dimensions = vecA ? vecA.length : 0;

  return {
    score,
    normalizedScore,
    dimensions,
  };
}