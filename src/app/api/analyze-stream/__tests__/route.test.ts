import { describe, it, expect, vi, beforeEach } from "vitest";
import { shortDocument, sampleDocuments } from "@/test/mocks/fixtures/documents";

// Mock the openai module
const mockCreate = vi.fn().mockImplementation(({ messages }) => {
  const systemMsg = messages.find((m: { role: string }) => m.role === "system")?.content || "";

  if (systemMsg.includes("sub model")) {
    return Promise.resolve({
      choices: [{ message: { content: JSON.stringify({ relevant: true, summary: "Finding", citations: ["chunk-1"] }) } }],
      usage: { total_tokens: 50 },
    });
  }

  if (systemMsg.includes("senior attorney")) {
    return Promise.resolve({
      choices: [{ message: { content: "Rewritten answer." } }],
      usage: { total_tokens: 80 },
    });
  }

  return Promise.resolve({
    choices: [{ message: { content: "Analysis response." } }],
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
import { POST } from "@/app/api/analyze-stream/route";

// Helper to create JSON request
function createJSONRequest(body: unknown): Request {
  return new Request("http://localhost/api/analyze-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Helper to read SSE stream and parse events
async function readSSEStream(response: Response): Promise<Array<{type: string; [key: string]: unknown}>> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No reader");

  const decoder = new TextDecoder();
  const events: Array<{type: string; [key: string]: unknown}> = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          events.push(JSON.parse(line.slice(6)));
        } catch {
          // Skip malformed
        }
      }
    }
  }

  return events;
}

describe("POST /api/analyze-stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("SSE format", () => {
    it("should return text/event-stream content type", async () => {
      const request = createJSONRequest({
        documents: [shortDocument],
        question: "What is this?",
        mode: "base",
      });
      const response = await POST(request);

      expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    });

    it("should include proper SSE headers", async () => {
      const request = createJSONRequest({
        documents: [shortDocument],
        question: "What is this?",
        mode: "base",
      });
      const response = await POST(request);

      expect(response.headers.get("Cache-Control")).toBe("no-cache");
      expect(response.headers.get("Connection")).toBe("keep-alive");
    });

    it("should emit log events with correct structure", async () => {
      const request = createJSONRequest({
        documents: [shortDocument],
        question: "What is this?",
        mode: "base",
      });
      const response = await POST(request);
      const events = await readSSEStream(response);

      const logEvents = events.filter(e => e.type === "log");
      expect(logEvents.length).toBeGreaterThan(0);

      const firstLog = logEvents[0];
      expect(firstLog.message).toBeDefined();
      expect(firstLog.logType).toBeDefined();
      expect(firstLog.timestamp).toBeDefined();
    });
  });

  describe("mode-specific streaming", () => {
    it("should stream events for base mode", async () => {
      const request = createJSONRequest({
        documents: [shortDocument],
        question: "Summarize",
        mode: "base",
      });
      const response = await POST(request);
      const events = await readSSEStream(response);

      const resultEvent = events.find(e => e.type === "result");
      expect(resultEvent).toBeDefined();
      expect((resultEvent?.data as {mode: string})?.mode).toBe("base");
    });

    it("should stream events for retrieval mode", async () => {
      const request = createJSONRequest({
        documents: sampleDocuments,
        question: "What are the terms?",
        mode: "retrieval",
        options: { chunkSize: 500, topK: 3 },
      });
      const response = await POST(request);
      const events = await readSSEStream(response);

      const logMessages = events
        .filter(e => e.type === "log")
        .map(e => e.message as string);

      expect(logMessages.some(m => m.includes("Chunking"))).toBe(true);
      expect(logMessages.some(m => m.includes("Ranking"))).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should return error JSON for validation failures", async () => {
      const request = createJSONRequest({
        documents: [],
        question: "",
        mode: "base",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should emit error event for runtime errors", async () => {
      const original = process.env.AZURE_OPENAI_DEPLOYMENT;
      const originalRoot = process.env.AZURE_OPENAI_DEPLOYMENT_ROOT;
      delete process.env.AZURE_OPENAI_DEPLOYMENT;
      delete process.env.AZURE_OPENAI_DEPLOYMENT_ROOT;

      vi.resetModules();

      vi.doMock("openai", () => ({
        AzureOpenAI: class {
          chat = {
            completions: {
              create: mockCreate,
            },
          };
        },
      }));

      const { POST: freshPOST } = await import("@/app/api/analyze-stream/route");

      const request = createJSONRequest({
        documents: [shortDocument],
        question: "Test",
        mode: "base",
      });
      const response = await freshPOST(request);
      const events = await readSSEStream(response);

      const errorEvent = events.find(e => e.type === "error");
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.error).toBeDefined();

      process.env.AZURE_OPENAI_DEPLOYMENT = original;
      process.env.AZURE_OPENAI_DEPLOYMENT_ROOT = originalRoot;
    });
  });

  describe("validation", () => {
    it("should validate required fields before streaming", async () => {
      const request = createJSONRequest({
        documents: [shortDocument],
        question: "",
        mode: "base",
      });
      const response = await POST(request);

      expect(response.headers.get("Content-Type")).toBe("application/json");
    });
  });

  describe("RLM mode streaming", () => {
    it("should stream batch progress for RLM mode", async () => {
      const request = createJSONRequest({
        documents: sampleDocuments,
        question: "Analyze the documents",
        mode: "rlm",
        options: { chunkSize: 500, maxSubcalls: 4, concurrency: 2 },
      });
      const response = await POST(request);
      const events = await readSSEStream(response);

      const logMessages = events
        .filter(e => e.type === "log")
        .map(e => e.message as string);

      expect(logMessages.some(m => m.includes("recursive") || m.includes("RLM"))).toBe(true);
    });
  });
});
