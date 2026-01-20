import { describe, it, expect } from "vitest";
import { mergeEntities, buildGraph, summarizeGraph } from "@/lib/graph";
import type { EntityExtraction } from "@/lib/types";

describe("graph", () => {
  describe("mergeEntities", () => {
    it("should merge identical entities from different chunks", () => {
      const extractions = [
        {
          chunkId: "chunk-1",
          extraction: {
            entities: [
              { type: "party" as const, name: "Acme Corp", confidence: 0.9 },
            ],
            relationships: [],
          },
        },
        {
          chunkId: "chunk-2",
          extraction: {
            entities: [
              { type: "party" as const, name: "Acme Corp", confidence: 0.8 },
            ],
            relationships: [],
          },
        },
      ];

      const nodes = mergeEntities(extractions);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe("Acme Corp");
      expect(nodes[0].sourceChunks).toEqual(["chunk-1", "chunk-2"]);
      expect(nodes[0].confidence).toBe(0.9); // Takes max confidence
    });

    it("should merge similar entities with high similarity", () => {
      const extractions = [
        {
          chunkId: "chunk-1",
          extraction: {
            entities: [
              { type: "party" as const, name: "Acme Corporation", confidence: 0.9 },
            ],
            relationships: [],
          },
        },
        {
          chunkId: "chunk-2",
          extraction: {
            entities: [
              { type: "party" as const, name: "Acme Corp", confidence: 0.8 },
            ],
            relationships: [],
          },
        },
      ];

      const nodes = mergeEntities(extractions);
      // Should merge because "Acme Corp" is contained in "Acme Corporation"
      expect(nodes).toHaveLength(1);
    });

    it("should keep different entities separate", () => {
      const extractions = [
        {
          chunkId: "chunk-1",
          extraction: {
            entities: [
              { type: "party" as const, name: "Acme Corp", confidence: 0.9 },
              { type: "party" as const, name: "Beta LLC", confidence: 0.8 },
            ],
            relationships: [],
          },
        },
      ];

      const nodes = mergeEntities(extractions);
      expect(nodes).toHaveLength(2);
    });

    it("should not merge entities of different types even with same name", () => {
      const extractions = [
        {
          chunkId: "chunk-1",
          extraction: {
            entities: [
              { type: "party" as const, name: "Payment", confidence: 0.9 },
              { type: "obligation" as const, name: "Payment", confidence: 0.8 },
            ],
            relationships: [],
          },
        },
      ];

      const nodes = mergeEntities(extractions);
      expect(nodes).toHaveLength(2);
    });

    it("should handle empty extractions", () => {
      const nodes = mergeEntities([]);
      expect(nodes).toHaveLength(0);
    });
  });

  describe("buildGraph", () => {
    it("should build a complete graph with nodes and edges", () => {
      const extractions = [
        {
          chunkId: "chunk-1",
          extraction: {
            entities: [
              { type: "party" as const, name: "Acme Corp", confidence: 0.9 },
              { type: "obligation" as const, name: "Payment of $50,000", confidence: 0.85 },
            ],
            relationships: [
              {
                type: "has_obligation" as const,
                sourceName: "Acme Corp",
                targetName: "Payment of $50,000",
                confidence: 0.8,
              },
            ],
          },
        },
      ];

      const graph = buildGraph(extractions, 1, "gpt-4");

      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toHaveLength(1);
      expect(graph.metadata.documentCount).toBe(1);
      expect(graph.metadata.chunkCount).toBe(1);
      expect(graph.metadata.extractionModel).toBe("gpt-4");

      // Check edge connects correct nodes
      const edge = graph.edges[0];
      const sourceNode = graph.nodes.find((n) => n.id === edge.source);
      const targetNode = graph.nodes.find((n) => n.id === edge.target);
      expect(sourceNode?.name).toBe("Acme Corp");
      expect(targetNode?.name).toBe("Payment of $50,000");
    });

    it("should not create edges for non-existent nodes", () => {
      const extractions = [
        {
          chunkId: "chunk-1",
          extraction: {
            entities: [
              { type: "party" as const, name: "Acme Corp", confidence: 0.9 },
            ],
            relationships: [
              {
                type: "has_obligation" as const,
                sourceName: "Acme Corp",
                targetName: "NonExistent Entity",
                confidence: 0.8,
              },
            ],
          },
        },
      ];

      const graph = buildGraph(extractions, 1, "gpt-4");
      expect(graph.edges).toHaveLength(0);
    });

    it("should not create duplicate edges", () => {
      const extractions = [
        {
          chunkId: "chunk-1",
          extraction: {
            entities: [
              { type: "party" as const, name: "Acme Corp", confidence: 0.9 },
              { type: "obligation" as const, name: "Payment", confidence: 0.85 },
            ],
            relationships: [
              {
                type: "has_obligation" as const,
                sourceName: "Acme Corp",
                targetName: "Payment",
                confidence: 0.8,
              },
            ],
          },
        },
        {
          chunkId: "chunk-2",
          extraction: {
            entities: [
              { type: "party" as const, name: "Acme Corp", confidence: 0.9 },
              { type: "obligation" as const, name: "Payment", confidence: 0.85 },
            ],
            relationships: [
              {
                type: "has_obligation" as const,
                sourceName: "Acme Corp",
                targetName: "Payment",
                confidence: 0.9,
              },
            ],
          },
        },
      ];

      const graph = buildGraph(extractions, 1, "gpt-4");
      expect(graph.edges).toHaveLength(1);
    });
  });

  describe("summarizeGraph", () => {
    it("should summarize an empty graph", () => {
      const graph = {
        nodes: [],
        edges: [],
        metadata: { documentCount: 0, chunkCount: 0, extractionModel: "gpt-4" },
      };

      const summary = summarizeGraph(graph);
      expect(summary).toContain("No entities");
    });

    it("should summarize a graph with nodes and edges", () => {
      const graph = {
        nodes: [
          { id: "n1", type: "party" as const, name: "Acme Corp", properties: {}, sourceChunks: ["chunk-1"], confidence: 0.9 },
          { id: "n2", type: "obligation" as const, name: "Payment", properties: {}, sourceChunks: ["chunk-1"], confidence: 0.85 },
        ],
        edges: [
          { id: "e1", type: "has_obligation" as const, source: "n1", target: "n2", properties: {}, sourceChunk: "chunk-1", confidence: 0.8 },
        ],
        metadata: { documentCount: 1, chunkCount: 1, extractionModel: "gpt-4" },
      };

      const summary = summarizeGraph(graph);
      expect(summary).toContain("Entities: 2");
      expect(summary).toContain("Relationships: 1");
      expect(summary).toContain("party");
      expect(summary).toContain("Acme Corp");
      expect(summary).toContain("Payment");
    });

    it("should group entities by type", () => {
      const graph = {
        nodes: [
          { id: "n1", type: "party" as const, name: "Acme Corp", properties: {}, sourceChunks: [], confidence: 0.9 },
          { id: "n2", type: "party" as const, name: "Beta LLC", properties: {}, sourceChunks: [], confidence: 0.9 },
          { id: "n3", type: "date" as const, name: "2024-01-01", properties: {}, sourceChunks: [], confidence: 0.9 },
        ],
        edges: [],
        metadata: { documentCount: 1, chunkCount: 1, extractionModel: "gpt-4" },
      };

      const summary = summarizeGraph(graph);
      expect(summary).toContain("party: Acme Corp, Beta LLC");
      expect(summary).toContain("date: 2024-01-01");
    });
  });
});
