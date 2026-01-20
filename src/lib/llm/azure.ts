import { AzureOpenAI } from "openai";
import "@azure/openai/types";
import { getAzureOpenAIConfig } from "@/config/env";

let client: AzureOpenAI | null = null;

const getClient = () => {
  if (client) {
    return client;
  }

  const { endpoint, apiKey, apiVersion } = getAzureOpenAIConfig();

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
