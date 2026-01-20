export type AnalyzeMode = "base" | "retrieval" | "rlm";

export type DocumentInput = {
  id: string;
  text: string;
};

export type AnalyzeOptions = {
  chunkSize?: number;
  topK?: number;
  maxSubcalls?: number;
  baseMaxChars?: number;
  concurrency?: number;
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
};

export type AnalyzeResponse = {
  answer: string;
  mode: AnalyzeMode;
  usage?: AnalyzeUsage;
  debug?: AnalyzeDebug;
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
