import { AzureOpenAI } from "openai";
import "@azure/openai/types";

let client: AzureOpenAI | null = null;

const getClient = () => {
  if (client) {
    return client;
  }

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const apiVersion =
    process.env.AZURE_OPENAI_API_VERSION ?? process.env.OPENAI_API_VERSION;

  const missing = [];
  if (!endpoint) missing.push("AZURE_OPENAI_ENDPOINT");
  if (!apiKey) missing.push("AZURE_OPENAI_API_KEY");
  if (!apiVersion) missing.push("AZURE_OPENAI_API_VERSION");

  if (missing.length > 0) {
    throw new Error(
      `Missing Azure OpenAI configuration: ${missing.join(", ")}.`,
    );
  }

  client = new AzureOpenAI({
    apiKey,
    endpoint,
    apiVersion,
  });
  return client;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export const chatCompletion = async ({
  deployment,
  messages,
  temperature = 0.2,
  maxTokens,
}: {
  deployment: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}) => {
  const result = await getClient().chat.completions.create({
    model: deployment,
    messages,
    temperature,
    max_tokens: maxTokens,
  });

  const choice = result.choices[0];
  return {
    content: choice?.message?.content?.trim() ?? "",
    usage: result.usage
      ? { totalTokens: result.usage.total_tokens }
      : undefined,
  };
};
