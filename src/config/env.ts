type AzureOpenAIConfig = {
  endpoint: string;
  apiKey: string;
  apiVersion: string;
};

export const getAzureOpenAIConfig = (): AzureOpenAIConfig => {
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

  return { endpoint, apiKey, apiVersion };
};

export const getRootDeployment = (errorMessage?: string) => {
  const rootDeployment =
    process.env.AZURE_OPENAI_DEPLOYMENT_ROOT ??
    process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!rootDeployment) {
    throw new Error(
      errorMessage ??
        "Missing AZURE_OPENAI_DEPLOYMENT (or AZURE_OPENAI_DEPLOYMENT_ROOT).",
    );
  }

  return rootDeployment;
};

export const getSubDeployment = (fallback = "gpt-5-nano") => {
  return process.env.AZURE_OPENAI_DEPLOYMENT_SUB ?? fallback;
};
