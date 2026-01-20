import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sampleDocuments,
  shortDocument,
  longDocument,
} from "@/test/mocks/fixtures/documents";

// Track call count for subcalls
let callCount = 0;

// Mock the openai module
const mockCreate = vi.fn().mockImplementation(({ messages }) => {
  callCount++;
  const systemMsg = messages.find((m: { role: string }) => m.role === "system")?.content || "";

  // Subcall response
  if (systemMsg.includes("sub model")) {
    return Promise.resolve({
      choices: [{ message: { content: JSON.stringify({ relevant: true, summary: "Test finding", citations: ["test-chunk"] }) } }],
      usage: { total_tokens: 50 },
    });
  }

  // Rewrite response
  if (systemMsg.includes("senior attorney")) {
    return Promise.resolve({
      choices: [{ message: { content: "Rewritten answer with citations [doc-1-chunk-1]." } }],
      usage: { total_tokens: 80 },
    });
  }

  // Default response
  return Promise.resolve({
    choices: [{ message: { content: "Analysis response with [doc-1-chunk-1] citations." } }],
    usage: { total_tokens: 100 },
  });
});

vi.mock("openai", () => {
  // Define the mock class inside the factory to avoid hoisting issues
  return {
    AzureOpenAI: class MockAzureOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

// Import after mocking
import { analyze } from "@/lib/analysis/analyze";

describe("analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callCount = 0;
  });

  describe("base mode", () => {
    it("should return response with mode=base", async () => {
      const result = await analyze({
        documents: [shortDocument],
        question: "What is this document about?",
        mode: "base",
      });

      expect(result.mode).toBe("base");
      expect(result.answer).toBeDefined();
      expect(typeof result.answer).toBe("string");
    });

    it("should include truncation info in debug when document is long", async () => {
      const result = await analyze({
        documents: [longDocument],
        question: "Summarize the document",
        mode: "base",
        options: { baseMaxChars: 1000 },
      });

      expect(result.debug?.truncated).toBe(true);
    });

    it("should not truncate short documents", async () => {
      const result = await analyze({
        documents: [shortDocument],
        question: "What is this?",
        mode: "base",
      });

      expect(result.debug?.truncated).toBe(false);
    });
  });

  describe("retrieval mode", () => {
    it("should return response with mode=retrieval", async () => {
      const result = await analyze({
        documents: sampleDocuments,
        question: "What are the payment terms?",
        mode: "retrieval",
      });

      expect(result.mode).toBe("retrieval");
      expect(result.answer).toBeDefined();
    });

    it("should include chunk statistics in debug", async () => {
      const result = await analyze({
        documents: sampleDocuments,
        question: "What are the payment terms?",
        mode: "retrieval",
        options: { chunkSize: 500 },
      });

      expect(result.debug?.chunksTotal).toBeGreaterThan(0);
      expect(result.debug?.chunksUsed).toBeGreaterThan(0);
      expect(result.debug?.chunksUsed).toBeLessThanOrEqual(
        result.debug?.chunksTotal ?? 0
      );
    });
  });

  describe("RLM mode", () => {
    it("should return response with mode=rlm", async () => {
      const result = await analyze({
        documents: sampleDocuments,
        question: "Summarize key points",
        mode: "rlm",
        options: { maxSubcalls: 2 },
      });

      expect(result.mode).toBe("rlm");
      expect(result.answer).toBeDefined();
    });

    it("should include subcalls count in debug", async () => {
      const result = await analyze({
        documents: sampleDocuments,
        question: "What are the key terms?",
        mode: "rlm",
        options: { chunkSize: 500, maxSubcalls: 5 },
      });

      expect(result.debug?.subcalls).toBeDefined();
      expect(result.debug?.subcalls).toBeLessThanOrEqual(5);
    });

    it("should limit subcalls to maxSubcalls option", async () => {
      const result = await analyze({
        documents: [longDocument],
        question: "Analyze all sections",
        mode: "rlm",
        options: { chunkSize: 200, maxSubcalls: 3 },
      });

      expect(result.debug?.subcalls).toBeLessThanOrEqual(3);
    });
  });

  describe("parseSubFinding", () => {
    it("should handle valid JSON responses", async () => {
      const result = await analyze({
        documents: [shortDocument],
        question: "Test",
        mode: "rlm",
        options: { maxSubcalls: 1 },
      });

      expect(result.answer).toBeDefined();
    });

    it("should handle malformed JSON gracefully", async () => {
      // Override mock to return malformed JSON for this test
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "not valid json" } }],
        usage: { total_tokens: 50 },
      }).mockResolvedValueOnce({
        choices: [{ message: { content: "Root response" } }],
        usage: { total_tokens: 100 },
      }).mockResolvedValueOnce({
        choices: [{ message: { content: "Rewritten response" } }],
        usage: { total_tokens: 80 },
      });

      const result = await analyze({
        documents: [shortDocument],
        question: "Test",
        mode: "rlm",
        options: { maxSubcalls: 1 },
      });

      expect(result.mode).toBe("rlm");
    });
  });

  describe("error handling", () => {
    it("should throw error when deployment is not configured", async () => {
      const originalDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
      const originalRoot = process.env.AZURE_OPENAI_DEPLOYMENT_ROOT;
      delete process.env.AZURE_OPENAI_DEPLOYMENT;
      delete process.env.AZURE_OPENAI_DEPLOYMENT_ROOT;

      vi.resetModules();

      // Re-mock after resetModules
      vi.doMock("openai", () => ({
        AzureOpenAI: class {
          chat = {
            completions: {
              create: mockCreate,
            },
          };
        },
      }));

      const { analyze: freshAnalyze } = await import("@/lib/analysis/analyze");

      await expect(
        freshAnalyze({
          documents: [shortDocument],
          question: "Test",
          mode: "base",
        })
      ).rejects.toThrow(/Missing AZURE_OPENAI_DEPLOYMENT/);

      process.env.AZURE_OPENAI_DEPLOYMENT = originalDeployment;
      process.env.AZURE_OPENAI_DEPLOYMENT_ROOT = originalRoot;
    });

    it("should normalize documents with missing IDs", async () => {
      const result = await analyze({
        documents: [{ id: "", text: "Test content" }],
        question: "What is this?",
        mode: "base",
      });

      expect(result.answer).toBeDefined();
    });
  });

  describe("usage tracking", () => {
    it("should accumulate token usage across calls", async () => {
      const result = await analyze({
        documents: sampleDocuments,
        question: "Test",
        mode: "rlm",
        options: { maxSubcalls: 3 },
      });

      expect(result.usage).toBeDefined();
      expect(result.usage?.totalTokens).toBeGreaterThan(0);
    });
  });

  describe("options handling", () => {
    it("should use default options when not provided", async () => {
      const result = await analyze({
        documents: [shortDocument],
        question: "Test",
        mode: "retrieval",
      });

      expect(result.answer).toBeDefined();
    });

    it("should merge provided options with defaults", async () => {
      const result = await analyze({
        documents: sampleDocuments,
        question: "Test",
        mode: "retrieval",
        options: { topK: 3 },
      });

      expect(result.debug?.chunksUsed).toBeLessThanOrEqual(3);
    });
  });
});
