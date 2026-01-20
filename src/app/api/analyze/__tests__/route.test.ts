import { describe, it, expect, vi, beforeEach } from "vitest";
import { shortDocument } from "@/test/mocks/fixtures/documents";
import { POST } from "@/app/api/analyze/route";

// Helper to create JSON request
function createJSONRequest(body: unknown): Request {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("request validation", () => {
    it("should return 400 when question is missing", async () => {
      const request = createJSONRequest({
        documents: [shortDocument],
        mode: "base",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("document and a question");
    });

    it("should return 400 when documents array is empty", async () => {
      const request = createJSONRequest({
        documents: [],
        question: "What is this?",
        mode: "base",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("document and a question");
    });

    it("should return 400 when documents is undefined", async () => {
      const request = createJSONRequest({
        question: "What is this?",
        mode: "base",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe("route configuration", () => {
    it("should export POST handler", async () => {
      const routeModule = await import("@/app/api/analyze/route");
      expect(typeof routeModule.POST).toBe("function");
    });

    it("should be configured for nodejs runtime", async () => {
      const routeModule = await import("@/app/api/analyze/route");
      expect(routeModule.runtime).toBe("nodejs");
    });
  });

  describe("error handling", () => {
    it("should return 500 when deployment config is missing", async () => {
      const original = process.env.AZURE_OPENAI_DEPLOYMENT;
      const originalRoot = process.env.AZURE_OPENAI_DEPLOYMENT_ROOT;
      delete process.env.AZURE_OPENAI_DEPLOYMENT;
      delete process.env.AZURE_OPENAI_DEPLOYMENT_ROOT;

      vi.resetModules();
      const { POST: freshPOST } = await import("@/app/api/analyze/route");

      const request = createJSONRequest({
        documents: [shortDocument],
        question: "Test",
        mode: "base",
      });
      const response = await freshPOST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();

      process.env.AZURE_OPENAI_DEPLOYMENT = original;
      process.env.AZURE_OPENAI_DEPLOYMENT_ROOT = originalRoot;
    });
  });
});
