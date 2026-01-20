import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the openai module - define mockCreate at module scope
const mockCreate = vi.fn();

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
import { chatCompletion } from "@/lib/llm/azure";

describe("chatCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: "Test response content",
          },
        },
      ],
      usage: {
        total_tokens: 100,
      },
    });
  });

  describe("successful completion", () => {
    it("should return content from chat completion", async () => {
      const result = await chatCompletion({
        deployment: "gpt-4",
        messages: [
          { role: "system", content: "You are helpful." },
          { role: "user", content: "Hello" },
        ],
      });

      expect(result.content).toBe("Test response content");
      expect(typeof result.content).toBe("string");
    });

    it("should return usage information", async () => {
      const result = await chatCompletion({
        deployment: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      });

      expect(result.usage).toBeDefined();
      expect(result.usage?.totalTokens).toBe(100);
    });

    it("should pass temperature parameter", async () => {
      await chatCompletion({
        deployment: "gpt-4",
        messages: [{ role: "user", content: "Test" }],
        temperature: 0.5,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.5,
        })
      );
    });

    it("should pass maxTokens parameter", async () => {
      await chatCompletion({
        deployment: "gpt-4",
        messages: [{ role: "user", content: "Test" }],
        maxTokens: 100,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 100,
        })
      );
    });
  });

  describe("configuration validation", () => {
    it("should throw error when Azure config is missing", async () => {
      // Temporarily clear environment variables
      const originalEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
      const originalApiKey = process.env.AZURE_OPENAI_API_KEY;
      const originalApiVersion = process.env.AZURE_OPENAI_API_VERSION;

      delete process.env.AZURE_OPENAI_ENDPOINT;
      delete process.env.AZURE_OPENAI_API_KEY;
      delete process.env.AZURE_OPENAI_API_VERSION;

      // Re-import to get fresh module without cached client
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

      const { chatCompletion: freshChatCompletion } = await import("@/lib/llm/azure");

      await expect(
        freshChatCompletion({
          deployment: "gpt-4",
          messages: [{ role: "user", content: "Test" }],
        })
      ).rejects.toThrow(/Missing Azure OpenAI configuration/);

      // Restore environment variables
      process.env.AZURE_OPENAI_ENDPOINT = originalEndpoint;
      process.env.AZURE_OPENAI_API_KEY = originalApiKey;
      process.env.AZURE_OPENAI_API_VERSION = originalApiVersion;
    });
  });
});
