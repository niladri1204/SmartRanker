/**
 * Server-only execution context.
 * Typed semantic-matching contracts, embedding provider abstractions,
 * and vector similarity data structures.
 */

/**
 * A typed numeric vector representing an embedding in vector space.
 */
export type EmbeddingVector = readonly number[];

/**
 * Metadata and identification for an embedding provider.
 */
export interface EmbeddingProviderInfo {
  readonly providerId: string;
  readonly modelName: string;
  readonly dimensions?: number;
}

/**
 * Provider-agnostic contract for generating vector embeddings.
 */
export interface IEmbeddingProvider extends EmbeddingProviderInfo {
  /**
   * Generates a vector embedding for a single text string.
   */
  embed(text: string): Promise<EmbeddingVector>;

  /**
   * Generates vector embeddings for a batch of text strings.
   */
  embedBatch(texts: readonly string[]): Promise<readonly EmbeddingVector[]>;
}

/**
 * Result of comparing two vectors for cosine similarity.
 */
export interface SimilarityResult {
  /**
   * Raw cosine similarity score in [-1, 1], where 1 is identical, 0 is orthogonal, -1 is opposite.
   */
  readonly score: number;
  /**
   * Normalized similarity score in [0, 1] suitable for percentage-based match ranking.
   */
  readonly normalizedScore: number;
  /**
   * Dimensionality of compared vectors.
   */
  readonly dimensions: number;
}

/**
 * Structured text payload prepared for semantic embedding.
 */
export interface SemanticTextPayload {
  readonly entityId: string;
  readonly entityType: "job" | "candidate";
  readonly fullText: string;
  readonly sections: {
    readonly titleOrRole?: string;
    readonly skills?: readonly string[];
    readonly experienceOrRequirements?: readonly string[];
    readonly education?: readonly string[];
    readonly summary?: string;
  };
}

/**
 * Input parameters for semantic match evaluation.
 */
export interface SemanticMatchInput {
  readonly jobText: string;
  readonly candidateText: string;
  readonly jobEmbedding?: EmbeddingVector;
  readonly candidateEmbedding?: EmbeddingVector;
}

/**
 * Output of a semantic match computation.
 */
export interface SemanticMatchOutput {
  readonly similarityScore: number; // 0 to 1 scale
  readonly rawCosineSimilarity: number; // -1 to 1 scale
  readonly providerInfo?: EmbeddingProviderInfo;
  readonly evaluatedAt: string;
}