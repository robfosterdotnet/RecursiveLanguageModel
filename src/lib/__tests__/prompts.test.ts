import { describe, it, expect } from "vitest";
import {
  ROOT_PROMPT,
  SUB_PROMPT,
  RETRIEVAL_PROMPT,
  REWRITE_PROMPT,
} from "@/lib/prompts";

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

  describe("general prompt properties", () => {
    it("all prompts should be non-empty strings", () => {
      expect(typeof ROOT_PROMPT).toBe("string");
      expect(typeof SUB_PROMPT).toBe("string");
      expect(typeof RETRIEVAL_PROMPT).toBe("string");
      expect(typeof REWRITE_PROMPT).toBe("string");

      expect(ROOT_PROMPT.length).toBeGreaterThan(0);
      expect(SUB_PROMPT.length).toBeGreaterThan(0);
      expect(RETRIEVAL_PROMPT.length).toBeGreaterThan(0);
      expect(REWRITE_PROMPT.length).toBeGreaterThan(0);
    });

    it("all prompts should be trimmed", () => {
      expect(ROOT_PROMPT).toBe(ROOT_PROMPT.trim());
      expect(SUB_PROMPT).toBe(SUB_PROMPT.trim());
      expect(RETRIEVAL_PROMPT).toBe(RETRIEVAL_PROMPT.trim());
      expect(REWRITE_PROMPT).toBe(REWRITE_PROMPT.trim());
    });
  });
});
