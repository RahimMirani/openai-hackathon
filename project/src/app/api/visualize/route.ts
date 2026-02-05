import { runLlmBackend } from "@/lib/llm/backend";
import { getAgentSystemPrompt } from "@/lib/agents/system-prompts";
import {
  deriveFallbackConfig,
  mergeGameConfig,
  type GameConfig,
} from "@/lib/workflow/game-config";
import { llmConceptExcerpt, resolveWorkflowInput, type WorkflowInputShape } from "@/lib/workflow/input";
import { parseJsonObjectFromText } from "@/lib/workflow/json";

const VISUALIZE_MODEL = "gpt-4.1-mini";
const VISUALIZE_SYSTEM_PROMPT = getAgentSystemPrompt(
  "visualize",
  "You are the Visualization Agent. Return valid JSON visual adjustments.",
);

type VisualizeRequestBody = WorkflowInputShape & {
  config?: Partial<GameConfig>;
};

type VisualizeCandidate = Partial<GameConfig> & {
  visualization?: Partial<GameConfig["visualization"]>;
  arena?: Partial<GameConfig["arena"]>;
  player?: Partial<GameConfig["player"]>;
  obstacles?: Partial<GameConfig["obstacles"]>;
  demonstration?: Partial<GameConfig["demonstration"]>;
  learning?: Partial<GameConfig["learning"]>;
};

function buildVisualPrompt(concept: string, sourceLabel: string, config: GameConfig): string {
  return [
    "You are the Visualization Agent.",
    "Adjust visual style for readability and concept-fit while preserving the physics demonstration.",
    "Return JSON only with optional keys: arena, player, obstacles, visualization, demonstration, learning.",
    "Color values must be valid #RRGGBB hex.",
    "Equation annotations and tutor tips should stay concise and student-friendly.",
    `Source: ${sourceLabel}`,
    `Concept input: ${llmConceptExcerpt(concept)}`,
    `Current config: ${JSON.stringify(config)}`,
  ].join("\n");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as VisualizeRequestBody | null;
  const resolved = resolveWorkflowInput(body, "Generated interactive demo");
  const concept = resolved.concept;

  let config = mergeGameConfig(body?.config ?? deriveFallbackConfig(concept));
  let usedLlm = false;

  try {
    const llm = await runLlmBackend({
      provider: "openai",
      model: VISUALIZE_MODEL,
      systemPrompt: VISUALIZE_SYSTEM_PROMPT,
      prompt: buildVisualPrompt(concept, resolved.sourceLabel, config),
    });

    usedLlm = llm.live;
    const parsed = parseJsonObjectFromText<VisualizeCandidate>(llm.output);
    if (parsed) {
      config = mergeGameConfig({
        ...config,
        ...parsed,
        arena: {
          ...config.arena,
          ...(parsed.arena ?? {}),
        },
        player: {
          ...config.player,
          ...(parsed.player ?? {}),
        },
        obstacles: {
          ...config.obstacles,
          ...(parsed.obstacles ?? {}),
        },
        visualization: {
          ...config.visualization,
          ...(parsed.visualization ?? {}),
        },
        demonstration: {
          ...config.demonstration,
          ...(parsed.demonstration ?? {}),
        },
        learning: {
          ...config.learning,
          ...(parsed.learning ?? {}),
        },
      });
    }
  } catch {
    config = mergeGameConfig(config);
  }

  return Response.json({
    ok: true,
    step: "visualize",
    sourceType: resolved.sourceType,
    usedLlm,
    usedVisualization: true,
    agent: {
      name: "visualize",
      tools: ["llm-api", "viz-tool"],
    },
    message: usedLlm
      ? "Visualization profile generated from OpenAI output."
      : "Visualization profile generated with fallback palette.",
    config,
    received: body,
    timestamp: new Date().toISOString(),
  });
}
