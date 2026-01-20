import type { Chunk } from "@/lib/analysis/types";

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);

const scoreChunk = (chunk: Chunk, queryTokens: string[]) => {
  const tokens = tokenize(chunk.text);
  if (tokens.length === 0) {
    return 0;
  }
  const counts = new Map<string, number>();
  tokens.forEach((token) => {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  });
  return queryTokens.reduce((score, token) => {
    const count = counts.get(token) ?? 0;
    return score + count;
  }, 0);
};

export const rankChunks = (chunks: Chunk[], query: string, topK = 8) => {
  const queryTokens = tokenize(query);
  const scored = chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, queryTokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((entry) => entry.chunk);

  return scored;
};
