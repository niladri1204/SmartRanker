/**
 * Server-only execution context.
 * Mock embedding provider for testing and offline development.
 * Produces deterministic, unit-normalized pseudo-embedding vectors based on token hashing.
 */
import { EmbeddingVector, IEmbeddingProvider } from "./semantic.interface";

export interface MockEmbeddingProviderOptions {
  readonly dimensions?: number;
  readonly modelName?: string;
  readonly providerId?: string;
}

export class MockEmbeddingProvider implements IEmbeddingProvider {
  public readonly providerId: string;
  public readonly modelName: string;
  public readonly dimensions: number;

  constructor(options: MockEmbeddingProviderOptions = {}) {
    this.providerId = options.providerId ?? "mock";
    this.modelName = options.modelName ?? "mock-embedding-v1";
    this.dimensions = options.dimensions ?? 64;
  }

  /**
   * Hashes a string using deterministic 32-bit FNV-1a.
   */
  private fnv1a(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  /**
   * Generates a deterministic unit-normalized pseudo-embedding vector for text.
   */
  public async embed(text: string): Promise<EmbeddingVector> {
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Array<number>(this.dimensions).fill(0);
    }

    const vector = new Array<number>(this.dimensions).fill(0);
    const tokens = text.toLowerCase().match(/[a-z0-9_#+.-]+/g) ?? [];

    if (tokens.length === 0) {
      return vector;
    }

    for (const token of tokens) {
      const hash = this.fnv1a(token);
      const index = hash % this.dimensions;
      // Deterministic sign and magnitude weighting
      const sign = (hash & 0x80000000) ? 1 : -1;
      const weight = 1 + (hash % 5) * 0.1;
      vector[index] += sign * weight;
    }

    // L2 normalization to unit vector
    let sumSq = 0;
    for (let i = 0; i < this.dimensions; i++) {
      sumSq += vector[i] * vector[i];
    }

    if (sumSq > 0) {
      const norm = Math.sqrt(sumSq);
      for (let i = 0; i < this.dimensions; i++) {
        vector[i] = Math.round((vector[i] / norm) * 1000000) / 1000000;
      }
    }

    return vector;
  }

  /**
   * Generates embeddings for a batch of text strings.
   */
  public async embedBatch(
    texts: readonly string[]
  ): Promise<readonly EmbeddingVector[]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    return Promise.all(texts.map((t) => this.embed(t)));
  }
}

export const mockEmbeddingProvider = new MockEmbeddingProvider();