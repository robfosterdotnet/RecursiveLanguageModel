export type AnalyzeMode = "base" | "retrieval" | "rlm" | "rlm-graph";

export type DocumentInput = {
  id: string;
  text: string;
};

export type AnalyzeOptions = {
  chunkSize?: number;
  topK?: number;
  maxSubcalls?: number;
  baseMaxChars?: number;
};

export type AnalyzeRequest = {
  documents: DocumentInput[];
  question: string;
  mode: AnalyzeMode;
  options?: AnalyzeOptions;
};

export type AnalyzeUsage = {
  totalTokens?: number;
};

export type AnalyzeDebug = {
  chunksTotal?: number;
  chunksUsed?: number;
  subcalls?: number;
  truncated?: boolean;
  mode?: AnalyzeMode;
  graphNodes?: number;
  graphEdges?: number;
};

export type AnalyzeResponse = {
  answer: string;
  mode: AnalyzeMode;
  usage?: AnalyzeUsage;
  debug?: AnalyzeDebug;
  graph?: KnowledgeGraph;
};

export type Chunk = {
  id: string;
  docId: string;
  index: number;
  text: string;
  start: number;
  end: number;
};

export type SubFinding = {
  relevant: boolean;
  summary: string;
  citations: string[];
  chunkId: string;
  docId: string;
};

// Knowledge Graph Types
export type EntityType =
  | "party"
  | "date"
  | "amount"
  | "clause"
  | "obligation"
  | "right"
  | "condition"
  | "document"
  | "section";

export type RelationType =
  | "has_obligation"
  | "has_right"
  | "references"
  | "depends_on"
  | "effective_on"
  | "expires_on"
  | "involves_amount"
  | "defined_in"
  | "related_to";

export type GraphNode = {
  id: string;
  type: EntityType;
  name: string;
  properties: Record<string, unknown>;
  sourceChunks: string[];
  confidence: number;
};

export type GraphEdge = {
  id: string;
  type: RelationType;
  source: string;
  target: string;
  properties: Record<string, unknown>;
  sourceChunk: string;
  confidence: number;
};

export type KnowledgeGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    documentCount: number;
    chunkCount: number;
    extractionModel: string;
  };
};

export type EntityExtraction = {
  entities: Array<{
    type: EntityType;
    name: string;
    properties?: Record<string, unknown>;
    confidence: number;
  }>;
  relationships: Array<{
    type: RelationType;
    sourceName: string;
    targetName: string;
    properties?: Record<string, unknown>;
    confidence: number;
  }>;
};
