export type LlmRequest = {
  provider: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
};

export type LlmResult = {
  output: string;
  provider: string;
  model: string;
  live: boolean;
};

type OpenAIOutputBlock = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

type OpenAIResponse = {
  output_text?: string;
  output?: OpenAIOutputBlock[];
  error?: {
    message?: string;
  };
};

function getOpenAIText(payload: OpenAIResponse): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (!Array.isArray(payload.output)) {
    return "";
  }

  return payload.output
    .flatMap((entry) => entry.content ?? [])
    .filter((entry) => entry.type === "output_text" && typeof entry.text === "string")
    .map((entry) => entry.text?.trim())
    .filter((entry): entry is string => Boolean(entry))
    .join("\n")
    .trim();
}

export async function requestOpenAI(
  model: string,
  prompt: string,
  systemPrompt?: string,
): Promise<string> {
  const envModule = await import("@/lib/env");
  const apiKey = envModule.getServerEnv("OPENAI_API_KEY");

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      ...(systemPrompt?.trim() ? { instructions: systemPrompt.trim() } : {}),
    }),
  });

  const payload = (await response.json()) as OpenAIResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "OpenAI request failed.");
  }

  const text = getOpenAIText(payload);

  if (!text) {
    throw new Error("OpenAI returned an empty response.");
  }

  return text;
}

export async function runLlmBackend(request: LlmRequest): Promise<LlmResult> {
  const provider = request.provider.trim().toLowerCase();
  const model = request.model.trim();
  const prompt = request.prompt.trim();

  if (provider === "openai") {
    const output = await requestOpenAI(model, prompt, request.systemPrompt);
    return {
      output,
      provider,
      model,
      live: true,
    };
  }

  const clippedPrompt =
    prompt.length > 200 ? `${prompt.slice(0, 200)}...` : prompt;

  return {
    output: `Mock response from ${provider}/${model}. Prompt: "${clippedPrompt}"`,
    provider,
    model,
    live: false,
  };
}
