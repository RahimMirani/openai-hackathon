import { NextResponse } from "next/server";
import { runLlmBackend } from "@/lib/llm/backend";

type LlmRequestBody = {
  provider?: string;
  model?: string;
  prompt?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as LlmRequestBody;

  const provider = body.provider?.trim().toLowerCase();
  const model = body.model?.trim();
  const prompt = body.prompt?.trim();

  if (!provider || !model || !prompt) {
    return NextResponse.json(
      { error: "provider, model, and prompt are required." },
      { status: 400 },
    );
  }

  if (provider === "openai") {
    try {
      const result = await runLlmBackend({ provider, model, prompt });
      return NextResponse.json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "OpenAI request failed.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const result = await runLlmBackend({ provider, model, prompt });
  return NextResponse.json(result);
}
