import { describe, it, expect } from "vitest";
import OpenAI from "openai";
import {
  OpenAiEmbeddingProvider,
  EmbeddingProviderError,
} from "../openai-embedding.provider";

describe("Phase 3.2: Production OpenAI Embedding Provider", () => {
  it("1. exposes correct metadata and rejects invalid or empty input", async () => {
    const provider = new OpenAiEmbeddingProvider({
      apiKey: "test-sk-key",
      modelName: "text-embedding-3-small",
    });

    expect(provider.providerId).toBe("openai");
    expect(provider.modelName).toBe("text-embedding-3-small");
    expect(provider.dimensions).toBe(1536);

    // Empty or whitespace-only single input rejected
    await expect(provider.embed("")).rejects.toThrowError(EmbeddingProviderError);
    await expect(provider.embed("   ")).rejects.toMatchObject({
      code: "EMPTY_INPUT",
    });

    // Empty batch input rejected
    await expect(provider.embedBatch([])).rejects.toMatchObject({
      code: "EMPTY_INPUT",
    });

    // Batch with whitespace item rejected
    await expect(provider.embedBatch(["valid text", "   "])).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("2. converts valid OpenAI SDK response into a typed embedding vector", async () => {
    let capturedParams: OpenAI.EmbeddingCreateParams | null = null;

    const mockClient = {
      embeddings: {
        create: async (params: OpenAI.EmbeddingCreateParams) => {
          capturedParams = params;
          return {
            data: [
              {
                index: 0,
                embedding: [0.0123, -0.0456, 0.0789, 0.9999],
                object: "embedding",
              },
            ],
            model: "text-embedding-3-small",
            usage: { prompt_tokens: 8, total_tokens: 8 },
            object: "list",
          };
        },
      },
    };

    const provider = new OpenAiEmbeddingProvider({
      client: mockClient as unknown as OpenAI,
      modelName: "text-embedding-3-small",
      dimensions: 4,
    });

    const vector = await provider.embed("Experienced TypeScript Engineer with React expertise");

    expect(vector).toEqual([0.0123, -0.0456, 0.0789, 0.9999]);
    expect(Object.isFrozen(vector)).toBe(true);
    expect(capturedParams).not.toBeNull();
    expect(capturedParams!.model).toBe("text-embedding-3-small");
    expect(capturedParams!.input).toBe("Experienced TypeScript Engineer with React expertise");
    expect(capturedParams!.dimensions).toBe(4);
  });

  it("3. preserves batch input ordering and validates vector dimensions", async () => {
    // Simulate OpenAI returning data items with out-of-order indexes
    const mockClient = {
      embeddings: {
        create: async (params: OpenAI.EmbeddingCreateParams) => ({
          data: [
            {
              index: 2,
              embedding: [0.5, 0.6],
              object: "embedding",
            },
            {
              index: 0,
              embedding: [0.1, 0.2],
              object: "embedding",
            },
            {
              index: 1,
              embedding: [0.3, 0.4],
              object: "embedding",
            },
          ],
          model: "text-embedding-3-small",
          object: "list",
        }),
      },
    };

    const provider = new OpenAiEmbeddingProvider({
      client: mockClient as unknown as OpenAI,
      modelName: "text-embedding-3-small",
    });

    const batchResults = await provider.embedBatch([
      "First text input",
      "Second text input",
      "Third text input",
    ]);

    // Preserves input order matching original array:
    expect(batchResults).toHaveLength(3);
    expect(batchResults[0]).toEqual([0.1, 0.2]); // index 0
    expect(batchResults[1]).toEqual([0.3, 0.4]); // index 1
    expect(batchResults[2]).toEqual([0.5, 0.6]); // index 2

    // Dimension inconsistency detection
    const inconsistentClient = {
      embeddings: {
        create: async () => ({
          data: [
            { index: 0, embedding: [0.1, 0.2] },
            { index: 1, embedding: [0.1, 0.2, 0.3] }, // mismatch
          ],
          model: "text-embedding-3-small",
        }),
      },
    };

    const inconsistentProvider = new OpenAiEmbeddingProvider({
      client: inconsistentClient as unknown as OpenAI,
    });

    await expect(
      inconsistentProvider.embedBatch(["Item A", "Item B"])
    ).rejects.toMatchObject({
      code: "MALFORMED_RESPONSE",
    });
  });

  it("4. converts configuration and API errors into safe domain errors", async () => {
    // 1. Missing API Key configuration error
    const unconfiguredProvider = new OpenAiEmbeddingProvider({
      apiKey: undefined,
    });

    await expect(unconfiguredProvider.embed("Some profile text")).rejects.toMatchObject({
      code: "CONFIG_ERROR",
      message: expect.stringContaining("OPENAI_API_KEY"),
    });

    // 2. Authentication failure (401)
    const authFailClient = {
      embeddings: {
        create: async () => {
          const err = new Error("Incorrect API key provided: sk-invalid...");
          (err as { status?: number }).status = 401;
          throw err;
        },
      },
    };

    const authFailProvider = new OpenAiEmbeddingProvider({
      client: authFailClient as unknown as OpenAI,
      apiKey: "sk-invalid",
    });

    await expect(authFailProvider.embed("Some text")).rejects.toMatchObject({
      code: "AUTHENTICATION_ERROR",
      message: expect.stringContaining("OpenAI authentication failed"),
    });

    // 3. Rate limit failure (429)
    const rateLimitClient = {
      embeddings: {
        create: async () => {
          const err = new Error("Rate limit exceeded for requests");
          (err as { status?: number }).status = 429;
          throw err;
        },
      },
    };

    const rateLimitProvider = new OpenAiEmbeddingProvider({
      client: rateLimitClient as unknown as OpenAI,
      apiKey: "sk-valid",
    });

    await expect(rateLimitProvider.embed("Some text")).rejects.toMatchObject({
      code: "RATE_LIMIT_ERROR",
      message: expect.stringContaining("rate limit exceeded"),
    });
  });
});