import type { Chunk, DocumentInput } from "@/lib/types";

const DEFAULT_CHUNK_SIZE = 1800;

type ChunkOptions = {
  chunkSize?: number;
};

const splitParagraphs = (text: string) =>
  text
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);

export const buildChunks = (
  documents: DocumentInput[],
  options: ChunkOptions = {},
): Chunk[] => {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunks: Chunk[] = [];

  documents.forEach((doc, docIndex) => {
    const paragraphs = splitParagraphs(doc.text);
    let buffer = "";
    let startOffset = 0;
    let chunkIndex = 0;

    const flush = (endOffset: number) => {
      if (!buffer.trim()) {
        return;
      }
      const id = `doc-${docIndex + 1}-chunk-${chunkIndex + 1}`;
      chunks.push({
        id,
        docId: doc.id,
        index: chunkIndex,
        text: buffer.trim(),
        start: startOffset,
        end: endOffset,
      });
      chunkIndex += 1;
      buffer = "";
      startOffset = endOffset;
    };

    let cursor = 0;
    paragraphs.forEach((paragraph) => {
      const next = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
      if (next.length > chunkSize && buffer) {
        flush(cursor);
      }
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
      cursor += paragraph.length + 2;
      if (buffer.length >= chunkSize) {
        flush(cursor);
      }
    });

    flush(cursor);
  });

  return chunks;
};
