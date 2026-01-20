import { describe, it, expect } from "vitest";
import {
  ROOT_PROMPT,
  SUB_PROMPT,
  RETRIEVAL_PROMPT,
  REWRITE_PROMPT,
  ENTITY_EXTRACTION_PROMPT,
  GRAPH_SUB_PROMPT,
  GRAPH_ROOT_PROMPT,
} from "@/lib/analysis/prompts";

describe("prompts", () => {
  describe("ROOT_PROMPT", () => {
    it("should contain instructions for root model", () => {
      expect(ROOT_PROMPT).toContain("root model");
    });

    it("should mention findings from snippets", () => {
      expect(ROOT_PROMPT).toContain("findings");
    });

    it("should include citation format instructions", () => {
      expect(ROOT_PROMPT).toMatch(/\[.*chunk.*\]/i);
    });
  });

  describe("SUB_PROMPT", () => {
    it("should contain instructions for sub model", () => {
      expect(SUB_PROMPT).toContain("sub model");
    });

    it("should specify JSON output format", () => {
      expect(SUB_PROMPT).toContain("JSON");
      expect(SUB_PROMPT).toContain("relevant");
      expect(SUB_PROMPT).toContain("summary");
      expect(SUB_PROMPT).toContain("citations");
    });
  });

  describe("RETRIEVAL_PROMPT", () => {
    it("should mention retrieved snippets", () => {
      expect(RETRIEVAL_PROMPT).toContain("retrieved snippets");
    });

    it("should include citation format instructions", () => {
      expect(RETRIEVAL_PROMPT).toMatch(/\[.*chunk.*\]/i);
    });
  });

  describe("REWRITE_PROMPT", () => {
    it("should mention legal precision", () => {
      expect(REWRITE_PROMPT).toContain("legal precision");
    });

    it("should instruct to preserve citations", () => {
      expect(REWRITE_PROMPT).toContain("citations");
    });
  });

  describe("ENTITY_EXTRACTION_PROMPT", () => {
    it("should list entity types", () => {
      expect(ENTITY_EXTRACTION_PROMPT).toContain("party");
      expect(ENTITY_EXTRACTION_PROMPT).toContain("date");
      expect(ENTITY_EXTRACTION_PROMPT).toContain("amount");
      expect(ENTITY_EXTRACTION_PROMPT).toContain("clause");
      expect(ENTITY_EXTRACTION_PROMPT).toContain("obligation");
    });

    it("should list relationship types", () => {
      expect(ENTITY_EXTRACTION_PROMPT).toContain("has_obligation");
      expect(ENTITY_EXTRACTION_PROMPT).toContain("has_right");
      expect(ENTITY_EXTRACTION_PROMPT).toContain("references");
    });

    it("should specify JSON output format", () => {
      expect(ENTITY_EXTRACTION_PROMPT).toContain("JSON");
      expect(ENTITY_EXTRACTION_PROMPT).toContain("entities");
      expect(ENTITY_EXTRACTION_PROMPT).toContain("relationships");
    });
  });

  describe("GRAPH_SUB_PROMPT", () => {
    it("should mention both findings and entities", () => {
      expect(GRAPH_SUB_PROMPT).toContain("FINDINGS");
      expect(GRAPH_SUB_PROMPT).toContain("ENTITIES");
    });

    it("should specify JSON output format", () => {
      expect(GRAPH_SUB_PROMPT).toContain("JSON");
      expect(GRAPH_SUB_PROMPT).toContain("finding");
      expect(GRAPH_SUB_PROMPT).toContain("extraction");
    });
  });

  describe("GRAPH_ROOT_PROMPT", () => {
    it("should mention knowledge graph context", () => {
      expect(GRAPH_ROOT_PROMPT).toContain("knowledge graph");
    });

    it("should include citation format instructions", () => {
      expect(GRAPH_ROOT_PROMPT).toMatch(/\[.*chunk.*\]/i);
    });
  });

  describe("general prompt properties", () => {
    it("all prompts should be non-empty strings", () => {
      expect(typeof ROOT_PROMPT).toBe("string");
      expect(typeof SUB_PROMPT).toBe("string");
      expect(typeof RETRIEVAL_PROMPT).toBe("string");
      expect(typeof REWRITE_PROMPT).toBe("string");
      expect(typeof ENTITY_EXTRACTION_PROMPT).toBe("string");
      expect(typeof GRAPH_SUB_PROMPT).toBe("string");
      expect(typeof GRAPH_ROOT_PROMPT).toBe("string");

      expect(ROOT_PROMPT.length).toBeGreaterThan(0);
      expect(SUB_PROMPT.length).toBeGreaterThan(0);
      expect(RETRIEVAL_PROMPT.length).toBeGreaterThan(0);
      expect(REWRITE_PROMPT.length).toBeGreaterThan(0);
      expect(ENTITY_EXTRACTION_PROMPT.length).toBeGreaterThan(0);
      expect(GRAPH_SUB_PROMPT.length).toBeGreaterThan(0);
      expect(GRAPH_ROOT_PROMPT.length).toBeGreaterThan(0);
    });

    it("all prompts should be trimmed", () => {
      expect(ROOT_PROMPT).toBe(ROOT_PROMPT.trim());
      expect(SUB_PROMPT).toBe(SUB_PROMPT.trim());
      expect(RETRIEVAL_PROMPT).toBe(RETRIEVAL_PROMPT.trim());
      expect(REWRITE_PROMPT).toBe(REWRITE_PROMPT.trim());
      expect(ENTITY_EXTRACTION_PROMPT).toBe(ENTITY_EXTRACTION_PROMPT.trim());
      expect(GRAPH_SUB_PROMPT).toBe(GRAPH_SUB_PROMPT.trim());
      expect(GRAPH_ROOT_PROMPT).toBe(GRAPH_ROOT_PROMPT.trim());
    });
  });
});
