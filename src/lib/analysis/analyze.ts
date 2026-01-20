import { getRootDeployment, getSubDeployment } from "@/config/env";
import { buildChunks } from "@/lib/analysis/chunking";
import {
  RETRIEVAL_PROMPT,
  REWRITE_PROMPT,
  ROOT_PROMPT,
  SUB_PROMPT,
} from "@/lib/analysis/prompts";
import { rankChunks } from "@/lib/analysis/retrieval";
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  Chunk,
  DocumentInput,
  SubFinding,
} from "@/lib/analysis/types";
import { chatCompletion } from "@/lib/llm/azure";

const DEFAULT_OPTIONS = {
  chunkSize: 1800,
  topK: 8,
  maxSubcalls: 24,
  baseMaxChars: 12000,
};

const normalizeDocuments = (documents: DocumentInput[]) =>
  documents.map((doc, index) => ({
    id: doc.id || `doc-${index + 1}`,
    text: doc.text ?? "",
  }));

const formatChunk = (chunk: Chunk) =>
  `[#${chunk.id}] (doc: ${chunk.docId})\n${chunk.text}`;

const extractJson = (text: string) => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
};

const parseSubFinding = (text: string, chunk: Chunk): SubFinding => {
  const json = extractJson(text);
  if (!json) {
    return {
      relevant: false,
      summary: "",
      citations: [],
      chunkId: chunk.id,
      docId: chunk.docId,
    };
  }
  try {
    const parsed = JSON.parse(json) as Partial<SubFinding>;
    const citations =
      parsed.citations && parsed.citations.length > 0
        ? parsed.citations
        : [chunk.id];
    return {
      relevant: Boolean(parsed.relevant),
      summary: parsed.summary ?? "",
      citations,
      chunkId: chunk.id,
      docId: chunk.docId,
    };
  } catch (error) {
    return {
      relevant: false,
      summary: "",
      citations: [],
      chunkId: chunk.id,
      docId: chunk.docId,
    };
  }
};

const addUsage = (
  total: AnalyzeResponse["usage"],
  next?: { totalTokens?: number },
) => {
  if (!next?.totalTokens) {
    return total;
  }
  return {
    totalTokens: (total?.totalTokens ?? 0) + next.totalTokens,
  };
};

const buildCombinedPrompt = (documents: DocumentInput[]) =>
  documents
    .map((doc, index) => `Document ${index + 1} (${doc.id}):\n${doc.text}`)
    .join("\n\n---\n\n");

const getSubcallTemperature = (deployment: string) =>
  deployment.toLowerCase().includes("nano") ? 1 : 0;

const rewriteAnswer = async (
  answer: string,
  question: string,
  deployment: string,
) => {
  if (!answer.trim()) {
    return { content: answer, usage: undefined as AnalyzeResponse["usage"] };
  }

  const result = await chatCompletion({
    deployment,
    messages: [
      { role: "system", content: REWRITE_PROMPT },
      {
        role: "user",
        content: `Question:\n${question}\n\nDraft answer:\n${answer}`,
      },
    ],
    temperature: 0.2,
  });

  return { content: result.content, usage: result.usage };
};

export const analyze = async (request: AnalyzeRequest): Promise<AnalyzeResponse> => {
  const documents = normalizeDocuments(request.documents);
  const question = request.question.trim();
  const mode = request.mode;
  const options = { ...DEFAULT_OPTIONS, ...request.options };

  const rootDeployment = getRootDeployment();
  const subDeployment = getSubDeployment();

  if (mode === "base") {
    const combined = buildCombinedPrompt(documents);
    const truncated = combined.length > options.baseMaxChars;
    const promptText = truncated ? combined.slice(0, options.baseMaxChars) : combined;

    const result = await chatCompletion({
      deployment: rootDeployment,
      messages: [
        {
          role: "system",
          content:
            "Answer the question using the provided documents. If insufficient, say so.",
        },
        {
          role: "user",
          content: `Question:\n${question}\n\nDocuments:\n${promptText}`,
        },
      ],
      temperature: 0.2,
    });

    let usage = addUsage(undefined, result.usage);
    const rewritten = await rewriteAnswer(
      result.content,
      question,
      rootDeployment,
    );
    usage = addUsage(usage, rewritten.usage ?? undefined);

    return {
      mode,
      answer: rewritten.content || result.content,
      usage,
      debug: {
        truncated,
        mode,
      },
    };
  }

  const chunks = buildChunks(documents, { chunkSize: options.chunkSize });

  if (mode === "retrieval") {
    const ranked = rankChunks(chunks, question, options.topK);
    const snippets = ranked.length > 0 ? ranked : chunks.slice(0, options.topK);
    const prompt = snippets.map(formatChunk).join("\n\n");

    const result = await chatCompletion({
      deployment: rootDeployment,
      messages: [
        { role: "system", content: RETRIEVAL_PROMPT },
        {
          role: "user",
          content: `Question:\n${question}\n\nSnippets:\n${prompt}`,
        },
      ],
      temperature: 0.2,
    });

    let usage = addUsage(undefined, result.usage);
    const rewritten = await rewriteAnswer(
      result.content,
      question,
      rootDeployment,
    );
    usage = addUsage(usage, rewritten.usage ?? undefined);

    return {
      mode,
      answer: rewritten.content || result.content,
      usage,
      debug: {
        chunksTotal: chunks.length,
        chunksUsed: snippets.length,
        mode,
      },
    };
  }

  // In comprehensive mode, process ALL chunks and include ALL findings
  const maxSubcalls = options.comprehensiveMode
    ? chunks.length
    : Math.min(options.maxSubcalls, chunks.length);
  const findings: SubFinding[] = [];
  let usage = undefined as AnalyzeResponse["usage"];

  for (let index = 0; index < maxSubcalls; index += 1) {
    const chunk = chunks[index];
    const subResult = await chatCompletion({
      deployment: subDeployment ?? rootDeployment,
      messages: [
        { role: "system", content: SUB_PROMPT },
        {
          role: "user",
          content: `Chunk ID: ${chunk.id}\nQuestion: ${question}\nSnippet:\n${chunk.text}`,
        },
      ],
      temperature: getSubcallTemperature(subDeployment ?? rootDeployment),
    });

    usage = addUsage(usage, subResult.usage);
    const finding = parseSubFinding(subResult.content, chunk);

    // In comprehensive mode, include ALL findings (even if marked as not relevant)
    // Otherwise, only include findings marked as relevant
    if (options.comprehensiveMode || finding.relevant) {
      findings.push(finding);
    }
  }

  const findingsText =
    findings.length > 0
      ? findings
          .map(
            (finding) =>
              `- ${finding.summary} (citations: ${finding.citations.join(", ")})`,
          )
          .join("\n")
      : "No relevant findings were extracted.";

  const rootResult = await chatCompletion({
    deployment: rootDeployment,
    messages: [
      { role: "system", content: ROOT_PROMPT },
      {
        role: "user",
        content: `Question:\n${question}\n\nFindings:\n${findingsText}`,
      },
    ],
    temperature: 0.2,
  });

  usage = addUsage(usage, rootResult.usage);
  const rewritten = await rewriteAnswer(
    rootResult.content,
    question,
    rootDeployment,
  );
  usage = addUsage(usage, rewritten.usage ?? undefined);

  return {
    mode,
    answer: rewritten.content || rootResult.content,
    usage,
    debug: {
      chunksTotal: chunks.length,
      chunksUsed: maxSubcalls,
      subcalls: maxSubcalls,
      mode,
    },
  };
};
