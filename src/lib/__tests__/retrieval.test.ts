import { describe, it, expect } from "vitest";
import { rankChunks } from "@/lib/retrieval";
import { sampleChunks } from "@/test/mocks/fixtures/documents";

describe("rankChunks", () => {
  describe("tokenize behavior", () => {
    it("should match chunks containing query terms (case-insensitive)", () => {
      const chunks = [
        { id: "1", docId: "d1", index: 0, text: "Payment terms are Net 30", start: 0, end: 25 },
        { id: "2", docId: "d1", index: 1, text: "Privacy policy details", start: 25, end: 50 },
        { id: "3", docId: "d1", index: 2, text: "Other unrelated content", start: 50, end: 75 },
      ];

      const ranked = rankChunks(chunks, "Payment Terms");

      expect(ranked.length).toBeGreaterThan(0);
      expect(ranked[0].id).toBe("1");
    });

    it("should handle queries with special characters", () => {
      const chunks = [
        { id: "1", docId: "d1", index: 0, text: "Test content here", start: 0, end: 20 },
      ];

      // Should not throw on special characters
      const result = rankChunks(chunks, "test@#$%content");
      expect(result).toHaveLength(1);
    });
  });

  describe("scoring logic", () => {
    it("should rank chunks with more matching terms higher", () => {
      const chunks = [
        { id: "1", docId: "d1", index: 0, text: "payment terms", start: 0, end: 15 },
        { id: "2", docId: "d1", index: 1, text: "payment terms payment terms payment", start: 15, end: 50 },
      ];

      const ranked = rankChunks(chunks, "payment terms");

      // Chunk with more occurrences should rank higher
      expect(ranked[0].id).toBe("2");
    });

    it("should filter out chunks with zero score", () => {
      const chunks = [
        { id: "1", docId: "d1", index: 0, text: "unrelated content", start: 0, end: 20 },
        { id: "2", docId: "d1", index: 1, text: "also unrelated", start: 20, end: 40 },
      ];

      const ranked = rankChunks(chunks, "payment terms");

      expect(ranked).toHaveLength(0);
    });
  });

  describe("topK parameter", () => {
    it("should return at most topK chunks", () => {
      const chunks = Array.from({ length: 20 }, (_, i) => ({
        id: `chunk-${i}`,
        docId: "d1",
        index: i,
        text: `This is chunk ${i} with test content`,
        start: i * 30,
        end: (i + 1) * 30,
      }));

      const ranked = rankChunks(chunks, "test content", 5);

      expect(ranked.length).toBeLessThanOrEqual(5);
    });

    it("should default to topK=8 when not specified", () => {
      const chunks = Array.from({ length: 20 }, (_, i) => ({
        id: `chunk-${i}`,
        docId: "d1",
        index: i,
        text: `This is chunk ${i} with test content`,
        start: i * 30,
        end: (i + 1) * 30,
      }));

      const ranked = rankChunks(chunks, "test content");

      expect(ranked.length).toBeLessThanOrEqual(8);
    });
  });

  describe("edge cases", () => {
    it("should handle empty chunks array", () => {
      const ranked = rankChunks([], "test query");
      expect(ranked).toHaveLength(0);
    });

    it("should handle empty query", () => {
      const ranked = rankChunks(sampleChunks, "");
      expect(ranked).toHaveLength(0);
    });

    it("should handle chunks with empty text", () => {
      const chunks = [
        { id: "1", docId: "d1", index: 0, text: "", start: 0, end: 0 },
        { id: "2", docId: "d1", index: 1, text: "actual content", start: 0, end: 15 },
      ];

      const ranked = rankChunks(chunks, "content");

      expect(ranked).toHaveLength(1);
      expect(ranked[0].id).toBe("2");
    });

    it("should return sorted by score descending", () => {
      const chunks = [
        { id: "low", docId: "d1", index: 0, text: "one mention of test", start: 0, end: 20 },
        { id: "high", docId: "d1", index: 1, text: "test test test multiple mentions", start: 20, end: 50 },
        { id: "medium", docId: "d1", index: 2, text: "test here and test there", start: 50, end: 75 },
      ];

      const ranked = rankChunks(chunks, "test");

      expect(ranked[0].id).toBe("high");
      expect(ranked[1].id).toBe("medium");
      expect(ranked[2].id).toBe("low");
    });
  });
});
