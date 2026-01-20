import { http, HttpResponse } from "msw";

// Use wildcard to match any Azure OpenAI endpoint
const AZURE_OPENAI_ENDPOINT_PATTERN = "https://*.openai.azure.com";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionRequest = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
};

// Helper to create a standard chat completion response
const createChatCompletionResponse = (content: string, totalTokens = 100) => ({
  id: "chatcmpl-test-id",
  object: "chat.completion",
  created: Date.now(),
  model: "gpt-4",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content,
      },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: Math.floor(totalTokens * 0.7),
    completion_tokens: Math.floor(totalTokens * 0.3),
    total_tokens: totalTokens,
  },
});

// Helper to detect if request is a subcall (for RLM mode)
const isSubcall = (messages: ChatMessage[]) => {
  const systemMessage = messages.find((m) => m.role === "system");
  return systemMessage?.content.includes("sub model analyzing");
};

// Helper to detect if request is a rewrite
const isRewriteRequest = (messages: ChatMessage[]) => {
  const systemMessage = messages.find((m) => m.role === "system");
  return systemMessage?.content.includes("senior attorney");
};

// Helper to create subcall response
const createSubcallResponse = (chunkId: string, relevant = true) => {
  if (!relevant) {
    return JSON.stringify({
      relevant: false,
      summary: "",
      citations: [],
    });
  }
  return JSON.stringify({
    relevant: true,
    summary: `Summary of findings from ${chunkId}`,
    citations: [chunkId],
  });
};

export const handlers = [
  // Azure OpenAI Chat Completions endpoint - matches any Azure endpoint
  http.post(
    `${AZURE_OPENAI_ENDPOINT_PATTERN}/openai/deployments/:deployment/chat/completions`,
    async ({ request, params }) => {
      const body = (await request.json()) as ChatCompletionRequest;
      const deployment = params.deployment as string;

      // Check if this is a subcall (RLM mode)
      if (isSubcall(body.messages)) {
        const userMessage = body.messages.find((m) => m.role === "user");
        const chunkIdMatch = userMessage?.content.match(/Chunk ID: ([\w-]+)/);
        const chunkId = chunkIdMatch?.[1] || "unknown-chunk";

        // Make some chunks irrelevant for testing
        const isRelevant = !chunkId.includes("chunk-3");

        return HttpResponse.json(
          createChatCompletionResponse(
            createSubcallResponse(chunkId, isRelevant),
            50
          )
        );
      }

      // Check if this is a rewrite request
      if (isRewriteRequest(body.messages)) {
        const userMessage = body.messages.find((m) => m.role === "user");
        const draftMatch = userMessage?.content.match(/Draft answer:\n([\s\S]+)/);
        const draft = draftMatch?.[1]?.trim() || "No draft provided";

        return HttpResponse.json(
          createChatCompletionResponse(
            `**Rewritten Answer**\n\n${draft}\n\n*This response has been rewritten for clarity.*`,
            80
          )
        );
      }

      // Standard completion response for base/retrieval/root modes
      return HttpResponse.json(
        createChatCompletionResponse(
          "This is a comprehensive analysis based on the provided documents. " +
            "Key findings include [doc-1-chunk-1]: The document contains important information. " +
            "[doc-1-chunk-2]: Additional relevant details were found.",
          150
        )
      );
    }
  ),

  // Error handler for testing error scenarios
  http.post(
    `${AZURE_OPENAI_ENDPOINT_PATTERN}/openai/deployments/error-deployment/chat/completions`,
    () => {
      return HttpResponse.json(
        {
          error: {
            message: "Deployment not found",
            type: "invalid_request_error",
            code: "deployment_not_found",
          },
        },
        { status: 404 }
      );
    }
  ),
];

// Export helpers for use in tests
export { createChatCompletionResponse, createSubcallResponse };
