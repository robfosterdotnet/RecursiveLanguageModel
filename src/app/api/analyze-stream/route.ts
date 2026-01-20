import { getRootDeployment, getSubDeployment } from "@/config/env";
import { buildChunks } from "@/lib/analysis/chunking";
import { buildGraph, summarizeGraph } from "@/lib/analysis/graph";
import {
  GRAPH_ROOT_PROMPT,
  GRAPH_SUB_PROMPT,
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
  EntityExtraction,
  EntityType,
  KnowledgeGraph,
  RelationType,
  SubFinding,
} from "@/lib/analysis/types";
import { chatCompletion } from "@/lib/llm/azure";
import { processWithPool } from "@/lib/utils/concurrency";

export const runtime = "nodejs";

const DEFAULT_OPTIONS = {
  chunkSize: 1800,
  topK: 8,
  maxSubcalls: 24,
  baseMaxChars: 12000,
  concurrency: 6,
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
  } catch {
    return {
      relevant: false,
      summary: "",
      citations: [],
      chunkId: chunk.id,
      docId: chunk.docId,
    };
  }
};

type GraphSubResult = {
  finding: SubFinding;
  extraction: EntityExtraction;
};

const VALID_ENTITY_TYPES: EntityType[] = [
  "party", "date", "amount", "clause", "obligation",
  "right", "condition", "document", "section",
];

const VALID_RELATION_TYPES: RelationType[] = [
  "has_obligation", "has_right", "references", "depends_on",
  "effective_on", "expires_on", "involves_amount", "defined_in", "related_to",
];

const parseGraphSubResult = (text: string, chunk: Chunk): GraphSubResult => {
  const json = extractJson(text);
  const emptyResult: GraphSubResult = {
    finding: {
      relevant: false,
      summary: "",
      citations: [],
      chunkId: chunk.id,
      docId: chunk.docId,
    },
    extraction: {
      entities: [],
      relationships: [],
    },
  };

  if (!json) {
    return emptyResult;
  }

  try {
    const parsed = JSON.parse(json);

    // Parse finding
    const findingData = parsed.finding ?? parsed;
    const citations =
      findingData.citations && findingData.citations.length > 0
        ? findingData.citations
        : [chunk.id];
    const finding: SubFinding = {
      relevant: Boolean(findingData.relevant),
      summary: findingData.summary ?? "",
      citations,
      chunkId: chunk.id,
      docId: chunk.docId,
    };

    // Parse extraction
    const extractionData = parsed.extraction ?? { entities: [], relationships: [] };
    const entities = (extractionData.entities ?? [])
      .filter((e: { type?: string; name?: string }) =>
        e.type && e.name && VALID_ENTITY_TYPES.includes(e.type as EntityType)
      )
      .map((e: { type: EntityType; name: string; properties?: Record<string, unknown>; confidence?: number }) => ({
        type: e.type as EntityType,
        name: String(e.name),
        properties: e.properties ?? {},
        confidence: typeof e.confidence === "number" ? e.confidence : 0.8,
      }));

    const relationships = (extractionData.relationships ?? [])
      .filter((r: { type?: string; sourceName?: string; targetName?: string }) =>
        r.type && r.sourceName && r.targetName &&
        VALID_RELATION_TYPES.includes(r.type as RelationType)
      )
      .map((r: { type: RelationType; sourceName: string; targetName: string; properties?: Record<string, unknown>; confidence?: number }) => ({
        type: r.type as RelationType,
        sourceName: String(r.sourceName),
        targetName: String(r.targetName),
        properties: r.properties ?? {},
        confidence: typeof r.confidence === "number" ? r.confidence : 0.8,
      }));

    return {
      finding,
      extraction: { entities, relationships },
    };
  } catch {
    return emptyResult;
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

type LogFn = (message: string, type?: "info" | "success" | "error" | "dim") => void;

const rewriteAnswer = async (
  answer: string,
  question: string,
  deployment: string,
  log: LogFn,
) => {
  if (!answer.trim()) {
    return { content: answer, usage: undefined as AnalyzeResponse["usage"] };
  }

  log("Rewriting answer for clarity...", "info");

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

  log("Rewrite complete", "success");
  return { content: result.content, usage: result.usage };
};

export async function POST(request: Request) {
  const body = (await request.json()) as AnalyzeRequest;

  if (!body.question || !body.documents || body.documents.length === 0) {
    return new Response(
      JSON.stringify({ error: "Provide at least one document and a question." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const log = (message: string, type: "info" | "success" | "error" | "dim" = "info") => {
        send({ type: "log", message, logType: type, timestamp: Date.now() });
      };

      try {
        const documents = normalizeDocuments(body.documents);
        const question = body.question.trim();
        const mode = body.mode;
        const options = { ...DEFAULT_OPTIONS, ...body.options };

        const rootDeployment = getRootDeployment("Missing AZURE_OPENAI_DEPLOYMENT.");
        const subDeployment = getSubDeployment();

        log(`Initializing ${mode.toUpperCase()} analysis...`, "info");
        log(`Processing ${documents.length} document(s)`, "dim");

        if (mode === "base") {
          log("Building combined prompt...", "info");
          const combined = buildCombinedPrompt(documents);
          const truncated = combined.length > options.baseMaxChars;
          const promptText = truncated ? combined.slice(0, options.baseMaxChars) : combined;

          if (truncated) {
            log(`Truncated to ${options.baseMaxChars.toLocaleString()} chars`, "dim");
          }

          log("Sending to LLM...", "info");
          const result = await chatCompletion({
            deployment: rootDeployment,
            messages: [
              {
                role: "system",
                content: "Answer the question using the provided documents. If insufficient, say so.",
              },
              {
                role: "user",
                content: `Question:\n${question}\n\nDocuments:\n${promptText}`,
              },
            ],
            temperature: 0.2,
          });

          let usage = addUsage(undefined, result.usage);
          log("LLM response received", "success");

          const rewritten = await rewriteAnswer(result.content, question, rootDeployment, log);
          usage = addUsage(usage, rewritten.usage ?? undefined);

          log("Analysis complete!", "success");

          send({
            type: "result",
            data: {
              mode,
              answer: rewritten.content || result.content,
              usage,
              debug: { truncated, mode },
            },
          });
        } else if (mode === "retrieval") {
          log("Chunking documents...", "info");
          const chunks = buildChunks(documents, { chunkSize: options.chunkSize });
          log(`Created ${chunks.length} chunks`, "success");

          log("Ranking chunks by relevance...", "info");
          const ranked = rankChunks(chunks, question, options.topK);
          const snippets = ranked.length > 0 ? ranked : chunks.slice(0, options.topK);
          log(`Selected top ${snippets.length} chunks`, "success");

          const prompt = snippets.map(formatChunk).join("\n\n");

          log("Sending to LLM...", "info");
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
          log("LLM response received", "success");

          const rewritten = await rewriteAnswer(result.content, question, rootDeployment, log);
          usage = addUsage(usage, rewritten.usage ?? undefined);

          log("Analysis complete!", "success");

          send({
            type: "result",
            data: {
              mode,
              answer: rewritten.content || result.content,
              usage,
              debug: {
                chunksTotal: chunks.length,
                chunksUsed: snippets.length,
                mode,
              },
            },
          });
        } else if (mode === "rlm") {
          // RLM mode
          log("Chunking documents...", "info");
          const chunks = buildChunks(documents, { chunkSize: options.chunkSize });
          log(`Created ${chunks.length} chunks`, "success");

          // In comprehensive mode, process ALL chunks
          const maxSubcalls = options.comprehensiveMode
            ? chunks.length
            : Math.min(options.maxSubcalls, chunks.length);
          const concurrency = options.concurrency ?? 6;
          const findings: SubFinding[] = [];
          let usage = undefined as AnalyzeResponse["usage"];

          log(
            `Starting recursive analysis (${maxSubcalls} chunks, ${concurrency} concurrent)${options.comprehensiveMode ? " - COMPREHENSIVE MODE" : ""}...`,
            "info"
          );

          const chunksToProcess = chunks.slice(0, maxSubcalls);

          // Process chunks with optimized worker pool
          // Unlike batch processing, pool keeps exactly `concurrency` requests in flight
          // at all times, starting a new request immediately when any completes.
          // This can be 30-50% faster when request times vary.
          const poolResults = await processWithPool(
            chunksToProcess,
            async (chunk) => {
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
              return subResult;
            },
            {
              concurrency,
              onProgress: (completed, total) => {
                log(`Completed ${completed}/${total} chunks`, "dim");
              },
            }
          );

          // Process results
          for (const { item: chunk, result: subResult } of poolResults) {
            usage = addUsage(usage, subResult.usage);
            const finding = parseSubFinding(subResult.content, chunk);

            // In comprehensive mode, include ALL findings (even if marked as not relevant)
            if (options.comprehensiveMode || finding.relevant) {
              findings.push(finding);
              log(`  ✓ Found ${finding.relevant ? "relevant" : "additional"} content in ${chunk.id}`, "success");
            }
          }

          log(`Extracted ${findings.length} relevant findings`, "success");

          const findingsText =
            findings.length > 0
              ? findings
                  .map(
                    (finding) =>
                      `- ${finding.summary} (citations: ${finding.citations.join(", ")})`,
                  )
                  .join("\n")
              : "No relevant findings were extracted.";

          log("Aggregating findings with root model...", "info");
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
          log("Aggregation complete", "success");

          const rewritten = await rewriteAnswer(rootResult.content, question, rootDeployment, log);
          usage = addUsage(usage, rewritten.usage ?? undefined);

          log("Analysis complete!", "success");

          send({
            type: "result",
            data: {
              mode,
              answer: rewritten.content || rootResult.content,
              usage,
              debug: {
                chunksTotal: chunks.length,
                chunksUsed: maxSubcalls,
                subcalls: maxSubcalls,
                mode,
              },
            },
          });
        } else if (mode === "rlm-graph") {
          // RLM + Graph mode
          log("Chunking documents...", "info");
          const chunks = buildChunks(documents, { chunkSize: options.chunkSize });
          log(`Created ${chunks.length} chunks`, "success");

          // In comprehensive mode, process ALL chunks
          const maxSubcalls = options.comprehensiveMode
            ? chunks.length
            : Math.min(options.maxSubcalls, chunks.length);
          const concurrency = options.concurrency ?? 6;
          const findings: SubFinding[] = [];
          const extractions: Array<{ chunkId: string; extraction: EntityExtraction }> = [];
          let usage = undefined as AnalyzeResponse["usage"];

          log(
            `Starting RLM + Graph analysis (${maxSubcalls} chunks, ${concurrency} concurrent)${options.comprehensiveMode ? " - COMPREHENSIVE MODE" : ""}...`,
            "info"
          );

          const chunksToProcess = chunks.slice(0, maxSubcalls);

          // Process chunks with optimized worker pool
          // Unlike batch processing, pool keeps exactly `concurrency` requests in flight
          // at all times, starting a new request immediately when any completes.
          const poolResults = await processWithPool(
            chunksToProcess,
            async (chunk) => {
              const subResult = await chatCompletion({
                deployment: subDeployment ?? rootDeployment,
                messages: [
                  { role: "system", content: GRAPH_SUB_PROMPT },
                  {
                    role: "user",
                    content: `Chunk ID: ${chunk.id}\nQuestion: ${question}\nSnippet:\n${chunk.text}`,
                  },
                ],
                temperature: getSubcallTemperature(subDeployment ?? rootDeployment),
              });
              return subResult;
            },
            {
              concurrency,
              onProgress: (completed, total) => {
                log(`Completed ${completed}/${total} chunks`, "dim");
              },
            }
          );

          // Process results
          for (const { item: chunk, result: subResult } of poolResults) {
            usage = addUsage(usage, subResult.usage);
            const graphResult = parseGraphSubResult(subResult.content, chunk);

            // In comprehensive mode, include ALL findings (even if marked as not relevant)
            if (options.comprehensiveMode || graphResult.finding.relevant) {
              findings.push(graphResult.finding);
              log(
                `  ✓ Found ${graphResult.finding.relevant ? "relevant" : "additional"} content in ${chunk.id}`,
                "success"
              );
            }

            // Always collect extractions even if finding not relevant
            if (graphResult.extraction.entities.length > 0 || graphResult.extraction.relationships.length > 0) {
              extractions.push({
                chunkId: chunk.id,
                extraction: graphResult.extraction,
              });
              log(`  📊 Extracted ${graphResult.extraction.entities.length} entities, ${graphResult.extraction.relationships.length} relationships from ${chunk.id}`, "dim");
            }
          }

          log(`Extracted ${findings.length} relevant findings`, "success");

          // Build knowledge graph
          log("Building knowledge graph...", "info");
          const graph: KnowledgeGraph = buildGraph(
            extractions,
            documents.length,
            subDeployment ?? rootDeployment,
          );
          log(`Graph built: ${graph.nodes.length} nodes, ${graph.edges.length} edges`, "success");

          // Send graph as separate event
          send({
            type: "graph",
            data: graph,
          });

          // Create graph summary for root prompt
          const graphSummary = summarizeGraph(graph);

          const findingsText =
            findings.length > 0
              ? findings
                  .map(
                    (finding) =>
                      `- ${finding.summary} (citations: ${finding.citations.join(", ")})`,
                  )
                  .join("\n")
              : "No relevant findings were extracted.";

          log("Aggregating findings with graph-aware root model...", "info");
          const rootResult = await chatCompletion({
            deployment: rootDeployment,
            messages: [
              { role: "system", content: GRAPH_ROOT_PROMPT },
              {
                role: "user",
                content: `Question:\n${question}\n\n${graphSummary}\n\nFindings:\n${findingsText}`,
              },
            ],
            temperature: 0.2,
          });

          usage = addUsage(usage, rootResult.usage);
          log("Aggregation complete", "success");

          const rewritten = await rewriteAnswer(rootResult.content, question, rootDeployment, log);
          usage = addUsage(usage, rewritten.usage ?? undefined);

          log("Analysis complete!", "success");

          send({
            type: "result",
            data: {
              mode,
              answer: rewritten.content || rootResult.content,
              usage,
              graph,
              debug: {
                chunksTotal: chunks.length,
                chunksUsed: maxSubcalls,
                subcalls: maxSubcalls,
                graphNodes: graph.nodes.length,
                graphEdges: graph.edges.length,
                mode,
              },
            },
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error.";
        send({ type: "log", message: `Error: ${message}`, logType: "error", timestamp: Date.now() });
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
