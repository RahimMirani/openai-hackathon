import { runLlmBackend } from "@/lib/llm/backend";
import { getAgentSystemPrompt } from "@/lib/agents/system-prompts";
import {
  deriveFallbackConfig,
  mergeGameConfig,
  type GameConfig,
} from "@/lib/workflow/game-config";
import {
  llmConceptExcerpt,
  resolveWorkflowInput,
  type WorkflowInputShape,
} from "@/lib/workflow/input";
import { parseJsonObjectFromText } from "@/lib/workflow/json";
import { applyIssueFixes, evaluateGameConfig } from "@/lib/workflow/playtest";

const FIX_MODEL = "gpt-4.1-mini";
const FIX_SYSTEM_PROMPT = getAgentSystemPrompt(
  "fix",
  "You are the Iteration Agent. Return minimal valid JSON tuning patches.",
);

type FixRequestBody = WorkflowInputShape & {
  issues?: string[];
  config?: Partial<GameConfig>;
};

type FixCandidate = Partial<GameConfig> & {
  config?: Partial<GameConfig>;
};

function buildFixPrompt(
  config: GameConfig,
  issues: string[],
  concept: string,
  sourceLabel: string,
): string {
  return [
    "You are the Iteration Agent.",
    "Apply focused tuning updates to resolve the issues.",
    "Return JSON only with full or partial game config keys.",
    `Source: ${sourceLabel}`,
    `Concept input: ${llmConceptExcerpt(concept)}`,
    `Issues: ${JSON.stringify(issues)}`,
    `Current config: ${JSON.stringify(config)}`,
  ].join("\n");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as FixRequestBody | null;
  const resolved = resolveWorkflowInput(body, "Generated interactive demo");
  const concept = resolved.concept;
  const issues = (body?.issues ?? []).filter(
    (issue): issue is string => typeof issue === "string" && issue.trim().length > 0,
  );

  let config = mergeGameConfig(body?.config ?? deriveFallbackConfig(concept));
  config = applyIssueFixes(config, issues);

  let usedLlm = false;
  if (issues.length > 0) {
    try {
      const llm = await runLlmBackend({
        provider: "openai",
        model: FIX_MODEL,
        systemPrompt: FIX_SYSTEM_PROMPT,
        prompt: buildFixPrompt(config, issues, concept, resolved.sourceLabel),
      });

      usedLlm = llm.live;
      const parsed = parseJsonObjectFromText<FixCandidate>(llm.output);
      const candidate = parsed?.config ?? parsed;
      if (candidate) {
        config = mergeGameConfig({
          ...config,
          ...candidate,
        });
      }
    } catch {
      config = mergeGameConfig(config);
    }
  }

  let validation = evaluateGameConfig(config, Math.min(45, config.rules.timer));
  if (validation.issues.length > 0 && issues.length > 0) {
    config = applyIssueFixes(config, validation.issues);
    validation = evaluateGameConfig(config, Math.min(45, config.rules.timer));
  }

  return Response.json({
    ok: true,
    step: "fix",
    sourceType: resolved.sourceType,
    usedLlm,
    usedPhysics: true,
    agent: {
      name: "fix",
      tools: ["llm-api", "physics-engine-tool"],
    },
    message:
      validation.issues.length === 0
        ? "Fixes applied and validated in simulation."
        : "Fixes applied; additional tuning opportunities remain.",
    config,
    remainingIssues: validation.issues,
    metrics: validation.metrics,
    received: body,
    timestamp: new Date().toISOString(),
  });
}
