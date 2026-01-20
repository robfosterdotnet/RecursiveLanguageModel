import type {
  EntityExtraction,
  EntityType,
  GraphEdge,
  GraphNode,
  KnowledgeGraph,
  RelationType,
} from "@/lib/types";

type ChunkExtraction = {
  chunkId: string;
  extraction: EntityExtraction;
};

const normalizeEntityName = (name: string): string => {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
};

const calculateSimilarity = (a: string, b: string): number => {
  const aNorm = normalizeEntityName(a);
  const bNorm = normalizeEntityName(b);

  if (aNorm === bNorm) return 1;

  // Check if one contains the other
  if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) {
    return 0.8;
  }

  // Simple Jaccard similarity on words
  const aWords = new Set(aNorm.split(" "));
  const bWords = new Set(bNorm.split(" "));
  const intersection = new Set([...aWords].filter((w) => bWords.has(w)));
  const union = new Set([...aWords, ...bWords]);

  return intersection.size / union.size;
};

type RawEntity = {
  type: EntityType;
  name: string;
  properties: Record<string, unknown>;
  confidence: number;
  sourceChunks: string[];
};

export const mergeEntities = (
  extractions: ChunkExtraction[],
  similarityThreshold = 0.7,
): GraphNode[] => {
  const rawEntities: RawEntity[] = [];

  // Collect all entities from extractions
  for (const { chunkId, extraction } of extractions) {
    for (const entity of extraction.entities) {
      rawEntities.push({
        type: entity.type,
        name: entity.name,
        properties: entity.properties ?? {},
        confidence: entity.confidence,
        sourceChunks: [chunkId],
      });
    }
  }

  // Group entities by type for more efficient merging
  const entitiesByType = new Map<EntityType, RawEntity[]>();
  for (const entity of rawEntities) {
    const existing = entitiesByType.get(entity.type) ?? [];
    existing.push(entity);
    entitiesByType.set(entity.type, existing);
  }

  // Merge similar entities within each type
  const mergedEntities: RawEntity[] = [];

  for (const [type, entities] of entitiesByType) {
    const merged: RawEntity[] = [];

    for (const entity of entities) {
      let foundMatch = false;

      for (const existing of merged) {
        const similarity = calculateSimilarity(entity.name, existing.name);
        if (similarity >= similarityThreshold) {
          // Merge into existing entity
          existing.sourceChunks = [
            ...new Set([...existing.sourceChunks, ...entity.sourceChunks]),
          ];
          existing.confidence = Math.max(existing.confidence, entity.confidence);
          // Merge properties, preferring higher confidence values
          existing.properties = { ...existing.properties, ...entity.properties };
          foundMatch = true;
          break;
        }
      }

      if (!foundMatch) {
        merged.push({ ...entity });
      }
    }

    mergedEntities.push(...merged);
  }

  // Convert to GraphNodes with unique IDs
  return mergedEntities.map((entity, index) => ({
    id: `n${index + 1}`,
    type: entity.type,
    name: entity.name,
    properties: entity.properties,
    sourceChunks: entity.sourceChunks,
    confidence: entity.confidence,
  }));
};

export const buildGraph = (
  extractions: ChunkExtraction[],
  documentCount: number,
  extractionModel: string,
): KnowledgeGraph => {
  // Merge entities
  const nodes = mergeEntities(extractions);

  // Build name-to-node lookup for edge construction
  const nodesByName = new Map<string, GraphNode>();
  for (const node of nodes) {
    nodesByName.set(normalizeEntityName(node.name), node);
  }

  // Find node by name with fuzzy matching
  const findNodeByName = (name: string): GraphNode | undefined => {
    const normalized = normalizeEntityName(name);

    // Exact match first
    if (nodesByName.has(normalized)) {
      return nodesByName.get(normalized);
    }

    // Fuzzy match
    for (const [nodeName, node] of nodesByName) {
      if (calculateSimilarity(normalized, nodeName) >= 0.7) {
        return node;
      }
    }

    return undefined;
  };

  // Build edges from relationships
  const edges: GraphEdge[] = [];
  let edgeIndex = 0;

  for (const { chunkId, extraction } of extractions) {
    for (const rel of extraction.relationships) {
      const sourceNode = findNodeByName(rel.sourceName);
      const targetNode = findNodeByName(rel.targetName);

      if (sourceNode && targetNode) {
        // Check if this edge already exists
        const existingEdge = edges.find(
          (e) =>
            e.type === rel.type &&
            e.source === sourceNode.id &&
            e.target === targetNode.id,
        );

        if (!existingEdge) {
          edgeIndex += 1;
          edges.push({
            id: `e${edgeIndex}`,
            type: rel.type as RelationType,
            source: sourceNode.id,
            target: targetNode.id,
            properties: rel.properties ?? {},
            sourceChunk: chunkId,
            confidence: rel.confidence,
          });
        }
      }
    }
  }

  return {
    nodes,
    edges,
    metadata: {
      documentCount,
      chunkCount: extractions.length,
      extractionModel,
    },
  };
};

export const summarizeGraph = (graph: KnowledgeGraph): string => {
  if (graph.nodes.length === 0) {
    return "No entities or relationships were extracted from the documents.";
  }

  const lines: string[] = [];
  lines.push("=== Knowledge Graph Summary ===\n");

  // Group nodes by type
  const nodesByType = new Map<EntityType, GraphNode[]>();
  for (const node of graph.nodes) {
    const existing = nodesByType.get(node.type) ?? [];
    existing.push(node);
    nodesByType.set(node.type, existing);
  }

  // Summary stats
  lines.push(`Entities: ${graph.nodes.length}`);
  lines.push(`Relationships: ${graph.edges.length}`);
  lines.push("");

  // List entities by type
  lines.push("--- Entities by Type ---");
  for (const [type, nodes] of nodesByType) {
    const names = nodes.map((n) => n.name).join(", ");
    lines.push(`${type}: ${names}`);
  }
  lines.push("");

  // List key relationships
  if (graph.edges.length > 0) {
    lines.push("--- Key Relationships ---");
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

    for (const edge of graph.edges.slice(0, 20)) {
      // Limit to 20 relationships for summary
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (source && target) {
        lines.push(`- ${source.name} --[${edge.type}]--> ${target.name}`);
      }
    }

    if (graph.edges.length > 20) {
      lines.push(`... and ${graph.edges.length - 20} more relationships`);
    }
  }

  return lines.join("\n");
};

export const serializeGraph = (graph: KnowledgeGraph): string => {
  return JSON.stringify(graph, null, 2);
};
