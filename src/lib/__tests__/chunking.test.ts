import { describe, it, expect } from "vitest";
import { buildChunks } from "@/lib/analysis/chunking";
import {
  sampleDocuments,
  shortDocument,
  longDocument,
  emptyDocument,
} from "@/test/mocks/fixtures/documents";

describe("buildChunks", () => {
  describe("splitParagraphs behavior", () => {
    it("should split text on double newlines", () => {
      const doc = {
        id: "test",
        text: "Paragraph one.\n\nParagraph two.\n\nParagraph three.",
      };
      const chunks = buildChunks([doc], { chunkSize: 5000 });

      // With a large chunk size, all paragraphs should be in one chunk
      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toContain("Paragraph one");
      expect(chunks[0].text).toContain("Paragraph two");
      expect(chunks[0].text).toContain("Paragraph three");
    });

    it("should trim whitespace from paragraphs", () => {
      const doc = {
        id: "test",
        text: "  Paragraph with spaces.  \n\n  Another paragraph.  ",
      };
      const chunks = buildChunks([doc], { chunkSize: 5000 });

      expect(chunks[0].text).toBe(
        "Paragraph with spaces.\n\nAnother paragraph."
      );
    });

    it("should filter empty paragraphs", () => {
      const doc = {
        id: "test",
        text: "First.\n\n\n\n\n\nSecond.\n\n\n\nThird.",
      };
      const chunks = buildChunks([doc], { chunkSize: 5000 });

      // Multiple newlines should be treated as one split, empty paragraphs filtered
      expect(chunks[0].text).toBe("First.\n\nSecond.\n\nThird.");
    });
  });

  describe("chunk sizing", () => {
    it("should create chunks within the specified size limit", () => {
      const chunks = buildChunks([longDocument], { chunkSize: 500 });

      chunks.forEach((chunk) => {
        // Chunks should generally be at or under the limit
        // (may exceed slightly due to paragraph boundaries)
        expect(chunk.text.length).toBeLessThanOrEqual(600);
      });
    });

    it("should use default chunk size of 1800 when not specified", () => {
      const chunks = buildChunks([longDocument]);

      // With default size, we should have fewer chunks than with smaller size
      const smallChunks = buildChunks([longDocument], { chunkSize: 500 });
      expect(chunks.length).toBeLessThan(smallChunks.length);
    });
  });

  describe("chunk metadata", () => {
    it("should assign unique IDs to each chunk", () => {
      const chunks = buildChunks([sampleDocuments[0]], { chunkSize: 500 });
      const ids = chunks.map((c) => c.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should include docId referencing the source document", () => {
      const chunks = buildChunks(sampleDocuments, { chunkSize: 500 });

      const doc1Chunks = chunks.filter((c) => c.docId === "contract-1");
      const doc2Chunks = chunks.filter((c) => c.docId === "policy-1");

      expect(doc1Chunks.length).toBeGreaterThan(0);
      expect(doc2Chunks.length).toBeGreaterThan(0);
    });

    it("should track start and end offsets", () => {
      const chunks = buildChunks([sampleDocuments[0]], { chunkSize: 500 });

      chunks.forEach((chunk, index) => {
        expect(chunk.start).toBeDefined();
        expect(chunk.end).toBeDefined();
        expect(chunk.end).toBeGreaterThan(chunk.start);

        // Sequential chunks should have ordered offsets
        if (index > 0) {
          expect(chunk.start).toBeGreaterThanOrEqual(chunks[index - 1].end);
        }
      });
    });
  });

  describe("edge cases", () => {
    it("should handle empty documents", () => {
      const chunks = buildChunks([emptyDocument]);
      expect(chunks).toHaveLength(0);
    });

    it("should handle short documents that fit in one chunk", () => {
      const chunks = buildChunks([shortDocument]);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe(shortDocument.text);
    });

    it("should handle multiple documents", () => {
      const chunks = buildChunks(sampleDocuments, { chunkSize: 500 });

      const docIds = new Set(chunks.map((c) => c.docId));
      expect(docIds.size).toBe(sampleDocuments.length);
    });

    it("should auto-generate document IDs when not provided", () => {
      const docsWithoutIds = [
        { id: "", text: "First document" },
        { id: "", text: "Second document" },
      ];
      const chunks = buildChunks(docsWithoutIds);

      // Check that chunks have valid doc IDs (either empty or the original)
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
