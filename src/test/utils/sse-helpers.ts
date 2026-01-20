import type { AnalyzeResponse } from "@/lib/types";

type LogEvent = {
  type: "log";
  message: string;
  logType: "info" | "success" | "error" | "dim";
  timestamp: number;
};

type ResultEvent = {
  type: "result";
  data: AnalyzeResponse;
};

type ErrorEvent = {
  type: "error";
  error: string;
};

type SSEEvent = LogEvent | ResultEvent | ErrorEvent;

/**
 * Creates an SSE data line from an event object
 */
export function createSSELine(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Creates a log event for SSE stream
 */
export function createLogEvent(
  message: string,
  logType: LogEvent["logType"] = "info"
): LogEvent {
  return {
    type: "log",
    message,
    logType,
    timestamp: Date.now(),
  };
}

/**
 * Creates a result event for SSE stream
 */
export function createResultEvent(data: AnalyzeResponse): ResultEvent {
  return {
    type: "result",
    data,
  };
}

/**
 * Creates an error event for SSE stream
 */
export function createErrorEvent(error: string): ErrorEvent {
  return {
    type: "error",
    error,
  };
}

/**
 * Creates a complete SSE stream string from an array of events
 */
export function createSSEStream(events: SSEEvent[]): string {
  return events.map(createSSELine).join("");
}

/**
 * Creates a mock ReadableStream that emits SSE events
 */
export function createMockSSEReadableStream(events: SSEEvent[]): ReadableStream {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index < events.length) {
        const event = events[index];
        controller.enqueue(encoder.encode(createSSELine(event)));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

/**
 * Creates a mock Response object with SSE stream
 */
export function createMockSSEResponse(
  events: SSEEvent[],
  status = 200
): Response {
  return new Response(createMockSSEReadableStream(events), {
    status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * Parses SSE stream data back into events
 */
export function parseSSEStream(data: string): SSEEvent[] {
  const lines = data.split("\n\n").filter(Boolean);
  return lines.map((line) => {
    const jsonStr = line.replace(/^data: /, "");
    return JSON.parse(jsonStr) as SSEEvent;
  });
}

/**
 * Sample SSE events for testing successful analysis
 */
export function createSampleSSEEvents(
  mode: "base" | "retrieval" | "rlm" = "base"
): SSEEvent[] {
  const events: SSEEvent[] = [
    createLogEvent(`Initializing ${mode.toUpperCase()} analysis...`, "info"),
    createLogEvent("Processing 1 document(s)", "dim"),
  ];

  if (mode === "base") {
    events.push(
      createLogEvent("Building combined prompt...", "info"),
      createLogEvent("Sending to LLM...", "info"),
      createLogEvent("LLM response received", "success"),
      createLogEvent("Rewriting answer for clarity...", "info"),
      createLogEvent("Rewrite complete", "success"),
      createLogEvent("Analysis complete!", "success")
    );
  } else if (mode === "retrieval") {
    events.push(
      createLogEvent("Chunking documents...", "info"),
      createLogEvent("Created 5 chunks", "success"),
      createLogEvent("Ranking chunks by relevance...", "info"),
      createLogEvent("Selected top 3 chunks", "success"),
      createLogEvent("Sending to LLM...", "info"),
      createLogEvent("LLM response received", "success"),
      createLogEvent("Rewriting answer for clarity...", "info"),
      createLogEvent("Rewrite complete", "success"),
      createLogEvent("Analysis complete!", "success")
    );
  } else {
    events.push(
      createLogEvent("Chunking documents...", "info"),
      createLogEvent("Created 10 chunks", "success"),
      createLogEvent("Starting recursive analysis (10 chunks, 6 concurrent)...", "info"),
      createLogEvent("Processing batch 1/2 (6 chunks)...", "dim"),
      createLogEvent("  ✓ Found relevant content in doc-1-chunk-1", "success"),
      createLogEvent("  ✓ Found relevant content in doc-1-chunk-2", "success"),
      createLogEvent("Completed 6/10 chunks", "dim"),
      createLogEvent("Processing batch 2/2 (4 chunks)...", "dim"),
      createLogEvent("Completed 10/10 chunks", "dim"),
      createLogEvent("Extracted 2 relevant findings", "success"),
      createLogEvent("Aggregating findings with root model...", "info"),
      createLogEvent("Aggregation complete", "success"),
      createLogEvent("Rewriting answer for clarity...", "info"),
      createLogEvent("Rewrite complete", "success"),
      createLogEvent("Analysis complete!", "success")
    );
  }

  events.push(
    createResultEvent({
      mode,
      answer: "This is the analysis result with [doc-1-chunk-1] citations.",
      usage: { totalTokens: 500 },
      debug: {
        chunksTotal: mode === "base" ? undefined : 10,
        chunksUsed: mode === "base" ? undefined : mode === "retrieval" ? 3 : 10,
        subcalls: mode === "rlm" ? 10 : undefined,
        truncated: mode === "base" ? false : undefined,
        mode,
      },
    })
  );

  return events;
}

/**
 * Sample SSE events for testing error scenarios
 */
export function createErrorSSEEvents(errorMessage: string): SSEEvent[] {
  return [
    createLogEvent("Initializing BASE analysis...", "info"),
    createLogEvent(`Error: ${errorMessage}`, "error"),
    createErrorEvent(errorMessage),
  ];
}
