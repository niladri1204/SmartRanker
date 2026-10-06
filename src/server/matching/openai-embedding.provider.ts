/**
 * Server-only execution context.
 * Production OpenAI Embedding Provider.
 * Connects the official OpenAI SDK to the provider-agnostic IEmbeddingProvider abstraction.
 * Secures API credentials strictly server-side and enforces robust validation and error isolation.
 */
import OpenAI from "openai";
import { envConfig } from "@/config/env";
import {
  EmbeddingVector,
  IEmbeddingProvider,
} from "./semantic.interface";

/**
 * Known default vector dimensionality for standard OpenAI models.
 */
const KNOWN_MODEL_DIMENSIONS: Record<string, number> = {
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
  "text-embedding-ada-002": 1536,
};

/**
 * Typed domain error for embedding provider failures.
 */
export class EmbeddingProviderError extends Error {
  public readonly code: string;
  public readonly providerId: string;

  constructor(
    message: string,
    options: {
      code?: string;
      providerId?: string;
      cause?: unknown;
    } = {}
  ) {
    super(message);
    this.name = "EmbeddingProviderError";
    this.code = options.code ?? "PROVIDER_ERROR";
    this.providerId = options.providerId ?? "openai";
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, EmbeddingProviderError.prototype);
  }
}

/**
 * Options for configuring OpenAiEmbeddingProvider.
 */
export interface OpenAiEmbeddingProviderOptions {
  /**
   * OpenAI API key. Falls back to OPENAI_API_KEY environment variable.
   */
  readonly apiKey?: string;
  /**
   * Embedding model name. Falls back to OPENAI_EMBEDDING_MODEL (default: text-embedding-3-small).
   */
  readonly modelName?: string;
  /**
   * Custom dimensionality override supported by text-embedding-3-* models.
   */
  readonly dimensions?: number;
  /**
   * Maximum request timeout in milliseconds (default: 30000ms).
   */
  readonly timeoutMs?: number;
  /**
   * Maximum retry attempts for transient network failures (default: 2).
   */
  readonly maxRetries?: number;
  /**
   * Optional pre-instantiated OpenAI client for dependency injection and testing.
   */
  readonly client?: OpenAI;
}

export class OpenAiEmbeddingProvider implements IEmbeddingProvider {
  public readonly providerId = "openai";
  public readonly modelName: string;
  public readonly dimensions?: number;

  private readonly customDimensions?: number;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private clientInstance?: OpenAI;

  constructor(options: OpenAiEmbeddingProviderOptions = {}) {
    this.modelName = options.modelName ?? envConfig.openAiEmbeddingModel;
    this.customDimensions = options.dimensions;
    this.dimensions =
      options.dimensions ?? KNOWN_MODEL_DIMENSIONS[this.modelName];
    this.apiKey = options.apiKey ?? envConfig.openAiApiKey;
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.maxRetries = options.maxRetries ?? 2;

    if (options.client) {
      this.clientInstance = options.client;
    }
  }

  /**
   * Lazily initializes and caches the server-side OpenAI client.
   */
  private getClient(): OpenAI {
    if (this.clientInstance) {
      return this.clientInstance;
    }

    if (!this.apiKey) {
      throw new EmbeddingProviderError(
        "OpenAI API key is not configured. Set OPENAI_API_KEY in server environment variables.",
        { code: "CONFIG_ERROR", providerId: this.providerId }
      );
    }

    this.clientInstance = new OpenAI({
      apiKey: this.apiKey,
      timeout: this.timeoutMs,
      maxRetries: this.maxRetries,
    });

    return this.clientInstance;
  }

  /**
   * Normalizes and sanitizes API/SDK errors into safe domain errors.
   * Prevents leaking prompts, resume contents, or sensitive credentials.
   */
  private handleError(err: unknown): never {
    if (err instanceof EmbeddingProviderError) {
      throw err;
    }

    const errorStatus =
      typeof err === "object" && err !== null && "status" in err
        ? (err as { status?: number }).status
        : undefined;

    if (
      err instanceof OpenAI.AuthenticationError ||
      errorStatus === 401
    ) {
      throw new EmbeddingProviderError(
        "OpenAI authentication failed. Verify that OPENAI_API_KEY is configured correctly.",
        { code: "AUTHENTICATION_ERROR", providerId: this.providerId, cause: err }
      );
    }

    if (
      err instanceof OpenAI.RateLimitError ||
      errorStatus === 429
    ) {
      throw new EmbeddingProviderError(
        "OpenAI embedding rate limit exceeded. Please retry after a brief delay.",
        { code: "RATE_LIMIT_ERROR", providerId: this.providerId, cause: err }
      );
    }

    if (
      err instanceof OpenAI.BadRequestError ||
      errorStatus === 400
    ) {
      throw new EmbeddingProviderError(
        "OpenAI rejected the embedding request due to invalid input parameters or context limit.",
        { code: "BAD_REQUEST_ERROR", providerId: this.providerId, cause: err }
      );
    }

    if (
      err instanceof OpenAI.APIConnectionTimeoutError ||
      err instanceof OpenAI.APIConnectionError
    ) {
      throw new EmbeddingProviderError(
        "OpenAI embedding service connection timed out or failed to connect.",
        { code: "NETWORK_ERROR", providerId: this.providerId, cause: err }
      );
    }

    throw new EmbeddingProviderError(
      "An unexpected server error occurred while generating embeddings with OpenAI.",
      { code: "PROVIDER_ERROR", providerId: this.providerId, cause: err }
    );
  }

  /**
   * Generates a single vector embedding for text.
   */
  public async embed(text: string): Promise<EmbeddingVector> {
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      throw new EmbeddingProviderError(
        "Cannot generate embedding for empty or whitespace-only text.",
        { code: "EMPTY_INPUT", providerId: this.providerId }
      );
    }

    const client = this.getClient();

    try {
      const params: OpenAI.EmbeddingCreateParams = {
        model: this.modelName,
        input: text.trim(),
      };

      if (this.customDimensions !== undefined) {
        params.dimensions = this.customDimensions;
      }

      const response = await client.embeddings.create(params);

      const vector = response?.data?.[0]?.embedding;
      if (!Array.isArray(vector) || vector.length === 0) {
        throw new EmbeddingProviderError(
          "OpenAI returned an empty or malformed embedding vector.",
          { code: "MALFORMED_RESPONSE", providerId: this.providerId }
        );
      }

      for (let i = 0; i < vector.length; i++) {
        const val = vector[i];
        if (typeof val !== "number" || !Number.isFinite(val)) {
          throw new EmbeddingProviderError(
            `OpenAI returned non-finite numerical value in embedding vector at index ${i}.`,
            { code: "MALFORMED_RESPONSE", providerId: this.providerId }
          );
        }
      }

      return Object.freeze([...vector]);
    } catch (err) {
      this.handleError(err);
    }
  }

  /**
   * Generates embeddings for a batch of text strings, preserving input ordering.
   */
  public async embedBatch(
    texts: readonly string[]
  ): Promise<readonly EmbeddingVector[]> {
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      throw new EmbeddingProviderError(
        "Cannot generate batch embeddings for an empty input list.",
        { code: "EMPTY_INPUT", providerId: this.providerId }
      );
    }

    const cleanedTexts: string[] = [];
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      if (typeof t !== "string" || t.trim().length === 0) {
        throw new EmbeddingProviderError(
          `Batch item at index ${i} is empty or invalid. All batch items must contain non-empty text.`,
          { code: "INVALID_INPUT", providerId: this.providerId }
        );
      }
      cleanedTexts.push(t.trim());
    }

    const client = this.getClient();

    try {
      const params: OpenAI.EmbeddingCreateParams = {
        model: this.modelName,
        input: cleanedTexts,
      };

      if (this.customDimensions !== undefined) {
        params.dimensions = this.customDimensions;
      }

      const response = await client.embeddings.create(params);

      if (
        !response?.data ||
        !Array.isArray(response.data) ||
        response.data.length !== texts.length
      ) {
        throw new EmbeddingProviderError(
          `OpenAI batch response count mismatch: expected ${texts.length} embeddings, received ${response?.data?.length ?? 0}.`,
          { code: "MALFORMED_RESPONSE", providerId: this.providerId }
        );
      }

      // Guarantee strict preservation of input order by mapping response index
      const sortedData = [...response.data].sort(
        (a, b) => (a.index ?? 0) - (b.index ?? 0)
      );

      const expectedDimensions = sortedData[0]?.embedding?.length;
      if (!expectedDimensions || expectedDimensions <= 0) {
        throw new EmbeddingProviderError(
          "OpenAI returned empty embedding vectors in batch response.",
          { code: "MALFORMED_RESPONSE", providerId: this.providerId }
        );
      }

      const resultVectors: EmbeddingVector[] = [];
      for (let i = 0; i < sortedData.length; i++) {
        const item = sortedData[i];
        const vec = item.embedding;

        if (!Array.isArray(vec) || vec.length !== expectedDimensions) {
          throw new EmbeddingProviderError(
            `OpenAI batch embedding dimension inconsistency at index ${i}: expected ${expectedDimensions}, got ${vec?.length}.`,
            { code: "MALFORMED_RESPONSE", providerId: this.providerId }
          );
        }

        for (let j = 0; j < vec.length; j++) {
          const val = vec[j];
          if (typeof val !== "number" || !Number.isFinite(val)) {
            throw new EmbeddingProviderError(
              `OpenAI returned non-finite numerical value in batch embedding vector at index ${i}, dimension ${j}.`,
              { code: "MALFORMED_RESPONSE", providerId: this.providerId }
            );
          }
        }

        resultVectors.push(Object.freeze([...vec]));
      }

      return Object.freeze(resultVectors);
    } catch (err) {
      this.handleError(err);
    }
  }
}

/**
 * Singleton instance configured with standard environment defaults.
 */
export const openAiEmbeddingProvider = new OpenAiEmbeddingProvider();